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
  this.element.add(this.domPlane)

  this.labelElement = document.createElement('div')
  this.labelElement.className = 'label'
  this.domElement = new THREE.CSS3DObject(this.labelElement)
  this.domElement.scale.x = 1 / 100
  this.domElement.scale.y = this.domElement.scale.x
  this.domElement.scale.z = this.domElement.scale.x
  this.domPlane.add(this.domElement)
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

  if (this.model && this.superview) {
    if (this.model.data.upstream) {
      this.upstream = this.superview.subviews[this.model.data.upstream]
    } else if (this.model.data.websocket_upstream) {
      this.upstream = this.superview.subviews[this.model.data.websocket_upstream]
    } else {
      delete this.upstream
    }
  } else {
    delete this.upstream
  }

  this.render()
  this._lastUpstream = this.upstream
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
      if (this.mesh) {
        this.element.remove(this.mesh)
        delete this.mesh
      }
    }

    if (!this.mesh) {
      this.mesh = this.generateMesh(0.5, this.model ? 0xFF8C19 : 0x333333)
      this.element.add(this.mesh)
      this.domPlane.position.y = -(0.5 + 0.4)
    }
  } else {
    if (this._wasRoot) {
      this.element.remove(this.mesh)
      delete this.mesh
      delete this._wasRoot
    }

    if (!this.mesh) {
      this.mesh = this.generateMesh(0.25, 0x666666)
      this.element.add(this.mesh)
      this.domPlane.position.y = -(0.25 + 0.4)
    }

    var breaks = []
    if (this.model.data.data) {
      breaks = this.model.data.data.breaks || []
      if (this.model.data.data.websocket_breaks) {
        breaks = breaks.concat(this.model.data.data.websocket_breaks)
      }
    }
    var missed = breaks.reduce(function (prev, next) { return prev + next }, 0)
    missed = missed > 100 && breaks !== this._lastBreaks
    this._lastBreaks = breaks

    var oldData = this.model.data.data && this.model.data.data.oldData
    var sawOldData = oldData && oldData !== this._lastOldData && this.model.data.timestamp - oldData < 15000
    this._lastOldData = oldData

    this.renderColor(missed, sawOldData)

    if (this.upstream !== this._lastUpstream) {
      this._nudge = this.body.position.clone()
      this._nudge = this._nudge.cross(new CANNON.Vec3(5, 5, 5))
    }
  }
}

NodeSingleView.prototype.generateMesh = function (radius, color) {
  var geometry = new THREE.SphereGeometry(radius, 64, 64)
  var material = this.material = new THREE.MeshPhongMaterial({ color: color })
  var mesh = new THREE.Mesh(geometry, material)
  mesh.userData.id = this.model && this.model.id
  return mesh
}

NodeSingleView.prototype.renderColor = function (missed, oldData) {
  var needsLock = false
  var color = null

  if (this.upstream) {
    if (this.upstream !== this._lastUpstream) {
      if (oldData) {
        color = 0xFFF41A
      } else {
        color = 0x1AB6FF
      }
      needsLock = true
    } else if (!this._colorLock) {
      if (missed) {
        color = 0xFF441A
        needsLock = true
      } else {
        if (this.model && this.model.data.websocket_state === 'connected') {
          if (!this.model.data.state) {
            color = 0xE599FF
          } else if (this.model.data.state === 'websocketconnected') {
            color = 0xC61AFF
          } else {
            color = 0x8CFF66
          }
        } else if (this.model && this.model.data.state === 'connected') {
          color = 0xFF8C19
        } else {
          color = 0x666666
        }
      }
    }
  } else {
    if (this.upstream !== this._lastUpstream && oldData) {
      color = 0xFFF41A
      needsLock = true
    } else if (!this._colorLock) {
      color = 0x666666
    }
  }

  if (color) {
    this.mesh.material.color = new THREE.Color(color)

    if (needsLock) {
      this._colorLock = true
      clearTimeout(this._colorLockTimer)
      this._colorLockTimer = setTimeout(function () {
        this._colorLock = false
        this.render()
      }.bind(this), 3500)
    }
  }
}

NodeSingleView.prototype.preStep = function () {
  this.body.quaternion.copy(this.superview.group.quaternion.clone().inverse())
  this.body.quaternion.mult(this.superview.camera.quaternion, this.body.quaternion)

  if (this.isRoot) {
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

  if (this._nudge) {
    force = force.vadd(this._nudge)
    delete this._nudge
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
