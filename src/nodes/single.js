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

  geometry = new THREE.PlaneBufferGeometry(1.1, 0.4, 2, 2)
  material = new THREE.MeshBasicMaterial({ color: 0x00 })
  material.opacity = 0
  this.domPlane = new THREE.Mesh(geometry, material)
  this.domPlane.position.z = -0.1

  this.labelElement = document.createElement('div')
  this.labelElement.className = 'label'
  this.domElement = new THREE.CSS3DObject(this.labelElement)
  this.domElement.scale.x = 1 / 100
  this.domElement.scale.y = this.domElement.scale.x
  this.domElement.scale.z = this.domElement.scale.x
}

NodeSingleView.prototype.show = function () {
  if (this.didShow) {
    return
  } else {
    this.didShow = true
  }

  if (!this.model) {
    this.render()
    return
  }

  this.model.on('update', this.update)
  this.model.watch()
  this.update()
}

NodeSingleView.prototype.update = function () {
  this.isRoot = !this.model || this.model.data.root

  if (this.model && this.model.data.upstream) {
    this.upstream = this.superview.subviews[this.model.data.upstream]
  } else {
    delete this.upstream
  }

  this.render()
}

NodeSingleView.prototype.render = function () {
  if (this.model) {
    var label = this.model.data.data && this.model.data.data.username
    if (label) {
      this.labelElement.textContent = label.slice(0, 5)
    } else {
      this.labelElement.textContent = this.model.id.slice(-5)
    }
  } else {
    this.labelElement.textContent = 'loading'
  }

  if (this.isRoot) {
    if (!this._wasRoot) {
      this._wasRoot = true
      if (this.surface) {
        this.element.remove(this.surface)
        delete this.surface
      }
    }

    if (!this.surface) {
      this.surface = this.generateSurface(0.5, this.model ? 0xFF8C19 : 0x333333)
      this.element.add(this.surface)
      this.domPlane.position.y = -(0.5 + 0.4)
    }

    if (!this.domPlane.parent) {
      this.domPlane.add(this.domElement)
      this.element.add(this.domPlane)
    }
  } else {
    if (this._wasRoot) {
      this.element.remove(this.surface)
      delete this.surface
      delete this._wasRoot
    }

    if (!this.surface) {
      this.surface = this.generateSurface(0.25, 0x666666)
      this.element.add(this.surface)
      this.domPlane.position.y = -(0.25 + 0.4)
    }

    if (this.upstream) {
      if (!this.domPlane.parent) {
        this.domPlane.add(this.domElement)
        this.element.add(this.domPlane)
      }
    } else {
      if (this.domPlane.parent) {
        this.domPlane.remove(this.domElement)
        this.element.remove(this.domPlane)
      }
    }
  }
}

NodeSingleView.prototype.generateSurface = function (radius, color) {
  var geometry = new THREE.SphereGeometry(radius, 64, 64)
  var material = this.material = new THREE.MeshPhongMaterial({ color: color })
  return new THREE.Mesh(geometry, material)
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

NodeSingleView.prototype.hide = function () {
  delete this._didShow

  this.domPlane.remove(this.domElement) // css objects need to be removed manually

  if (this.model) {
    if (!this.collection) this.model.unwatch()
    this.model.removeListener('update', this.update)
  }

  delete this.upstream
}

function random (max) {
  return -max + Math.random() * max * 2
}
