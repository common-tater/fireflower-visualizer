module.exports = NodeSingleView

var THREE = require('three')
var CANNON = require('cannon')

function NodeSingleView () {
  this.update = this.update.bind(this)

  this.body = new CANNON.Body({
    mass: 0.1,
    material: new CANNON.Material()
  })
  this.body.preStep = this.preStep.bind(this)

  this.element = new THREE.Group()

  geometry = new THREE.PlaneBufferGeometry(1, 0.5, 2, 2)
  material = new THREE.MeshBasicMaterial({ color: 0x00 })
  material.opacity = 0
  this.domPlane = new THREE.Mesh(geometry, material)
  this.domPlane.position.y = -1.0
  this.domPlane.position.z = -0.1
  this.element.add(this.domPlane)

  this.labelElement = document.createElement('div')
  this.labelElement.className = 'label'
  this.labelElement.textContent = "ƒƒ"
  this.domElement = new THREE.CSS3DObject(this.labelElement)
  this.domElement.scale.x = 1 / 100
  this.domElement.scale.y = this.domElement.scale.x
  this.domElement.scale.z = this.domElement.scale.x
  this.domPlane.add(this.domElement)
}

NodeSingleView.prototype.setupSurface = function (radius, color) {
  if (this.surface) {
    if (this.surface.isRoot === this.isRoot) {
      return
    }
    this.element.remove(this.surface)
  }

  this.domPlane.position.y = this.isRoot ? -1.25 : -0.8

  var geometry = new THREE.SphereGeometry(radius, 64, 64)
  var material = this.material = new THREE.MeshPhongMaterial({ color: color })
  this.surface = new THREE.Mesh(geometry, material)
  this.surface.isRoot = this.isRoot
  this.element.add(this.surface)
}

NodeSingleView.prototype.show = function () {
  if (this.didShow) {
    return
  } else {
    this.didShow = true
  }

  if (!this.model) {
    this.element.remove(this.domPlane)
    return
  }

  this.model.on('update', this.update)
  this.model.watch()
  this.update()
}

NodeSingleView.prototype.update = function () {
  this.isRoot = !this.model || this.model.data.root
  this.labelElement.textContent = this.model.id.slice(-5)

  if (this.isRoot) {
    this.setupSurface(0.5, 0xFF8C19)
  } else {
    this.setupSurface(0.25, 0x666666)
  }

  if (this.model && this.model.data.upstream) {
    if (this.upstream) {
      if (this.model.data.upstream === this.upstream.model.id) {
        return
      }
      this.disconnectUpstream()
    }

    this.connectUpstream()
  } else {
    this.disconnectUpstream()
  }
}

NodeSingleView.prototype.preStep = function () {
  this.body.quaternion.copy(this.superview.group.quaternion.clone().inverse())
  this.body.quaternion.mult(this.superview.camera.quaternion, this.body.quaternion)

  if (!this.upstream) {
    return
  }

  var forces = []
  var force = null
  var gap = null

  for (var i in this.superview.subviews) {
    var peer = this.superview.subviews[i]
    if (peer !== this && peer.upstream !== this) {
      forces.push(this.enforcePeerGap(peer))
    }
  }

  force = new CANNON.Vec3(0, 0, 0)

  for (var i in forces) {
    var f = forces[i]
    if (f) force = force.vadd(f)
  }

  this.body.force = force
}

NodeSingleView.prototype.enforcePeerGap = function (peer) {
  var id = this.id
  var gap = peer === this.upstream ? 2 : 4
  var position = this.body.position.clone()
  var target = null
  var force = null

  if (peer === this.upstream && !peer.isRoot) {
    var upstreamDistanceToRoot = peer.body.position.distanceTo(new CANNON.Vec3(0,0,0))
    if (upstreamDistanceToRoot > 0) {
      target = peer.body.position.scale((upstreamDistanceToRoot + gap) / upstreamDistanceToRoot)
    }
  } else {
    if (position.almostEquals(peer.body.position)) {
      position.x += random(0.1)
      position.y += random(0.1)
      position.z += random(0.1)
    }

    var distanceToPeer = position.distanceTo(peer.body.position)
    if (distanceToPeer < gap || (distanceToPeer > gap && peer === this.upstream)) {
      target = position.vsub(peer.body.position)
      target = target.scale(gap / distanceToPeer)
      target = peer.body.position.vadd(target)
    }
  }

  if (target) {
    var distanceToTarget = position.distanceTo(target)
    force = target.vsub(position)
  }

  return force
}

NodeSingleView.prototype.connectUpstream = function () {
  this.upstream = this.superview.subviews[this.model.data.upstream]
}

NodeSingleView.prototype.disconnectUpstream = function () {
  delete this.upstream
}

NodeSingleView.prototype.hide = function () {
  delete this._didShow

  this.domPlane.remove(this.domElement) // css objects need to be removed manually

  if (this.model) {
    if (!this.collection) this.model.unwatch()
    this.model.removeListener('update', this.update)
  }

  if (this.upstream) {
    this.disconnectUpstream()
  }
}

function random (max) {
  return -max + Math.random() * max * 2
}
