import * as THREE from 'three'
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'
import CANNON from 'cannon'

// Attach addon to THREE global specific for this module scope if needed, or just use CSS3DObject directly
// THREE.CSS3DObject = CSS3DObject // Removed because imports are immutable

var ZERO_VEC = new CANNON.Vec3(0, 0, 0)

function NodeSingleView () {
  this.update = this.update.bind(this)

  this.body = new CANNON.Body({
    mass: 0.1,
    material: new CANNON.Material()
  })
  this.body.preStep = this.preStep.bind(this)

  this.element = new THREE.Group()

  geometry = new THREE.PlaneGeometry(1.6, 0.6, 2, 2)
  material = new THREE.MeshBasicMaterial({ color: 0x00, transparent: true })
  material.opacity = 0
  this.domPlane = new THREE.Mesh(geometry, material)
  this.domPlane.position.z = -0.1
  this.element.add(this.domPlane)

  this.labelElement = document.createElement('div')
  this.labelElement.className = 'label'
  this.labelElement.style.backgroundColor = 'transparent'
  this.labelElement.style.color = 'white'
  this.domElement = new CSS3DObject(this.labelElement)
  this.domElement.scale.x = 1 / 100
  this.domElement.scale.y = this.domElement.scale.x
  this.domElement.scale.z = this.domElement.scale.x
  this.domPlane.add(this.domElement)

  // Initialization for expert physics
  this._tmpVec = new CANNON.Vec3()
  this._pullVec = new CANNON.Vec3()
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
  this.isServer = this.model && this.model.data.isServer

  if (this.model && this.model.data.upstream) {
    this.upstream = this.superview.subviews[this.model.data.upstream]
  } else {
    delete this.upstream
  }

  this.render()
  this._lastUpstream = this.upstream
}

NodeSingleView.prototype.render = function () {
  var health = this.model && this.model.data.health
  var score = health ? health.score : null

  if (this.model) {
    var label = this.model.data.data && this.model.data.data.username
    var transport = this.model.data.transport
    var id = label ? label.slice(0, 5) : this.model.id.slice(-5)
    var name, color, scoreColor

    if (this.isServer) {
      name = 'SERVER'
      color = '#00CED1'
      scoreColor = '#66DDE0'
    } else if (this.isRoot) {
      name = id
      color = '#FF8C19'
      scoreColor = '#FFAA55'
    } else if (transport === 'server') {
      name = id + ' [S]'
      color = '#00CED1'
      scoreColor = '#66DDE0'
    } else {
      name = id
      color = '#FFF'
      scoreColor = '#AAA'
    }

    this.labelElement.style.color = color
    var capacityHtml = this._renderCapacity()
    var labelHtml = '<span>' + name + '</span>'

    if (score != null || capacityHtml) {
      labelHtml += '<div class="score" style="color:' + scoreColor + '">'
      if (score != null) labelHtml += '<span>' + score + '</span>'
      if (capacityHtml) labelHtml += capacityHtml
      labelHtml += '</div>'
    }

    this.labelElement.innerHTML = labelHtml
  } else {
    this.labelElement.textContent = 'loading'
  }

  // Server node: cyan, medium-sized, fixed position
  if (this.isServer) {
    if (!this._wasServer) {
      this._wasServer = true
      if (this.mesh) {
        this.element.remove(this.mesh)
        delete this.mesh
      }
    }

    if (!this.mesh) {
      this.mesh = this.generateMesh(0.4, 0x00CED1)
      this.element.add(this.mesh)
      this.domPlane.position.y = -(0.4 + 0.4)
    }
  } else if (this.isRoot) {
    if (this._wasServer || !this._wasRoot) {
      this._wasRoot = true
      delete this._wasServer
      if (this.mesh) {
        this.element.remove(this.mesh)
        delete this.mesh
      }
      if (this._ringMesh) {
        this.element.remove(this._ringMesh)
        delete this._ringMesh
      }
    }

    if (!this.mesh) {
      this.mesh = this.generateMesh(0.5, this.model ? 0x666666 : 0x333333)
      this.element.add(this.mesh)
      this.domPlane.position.y = -(0.5 + 0.4)

      // White wireframe ring to identify root
      var ringGeo = new THREE.SphereGeometry(0.55, 16, 16)
      var ringMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, wireframe: true, transparent: true, opacity: 0.4 })
      this._ringMesh = new THREE.Mesh(ringGeo, ringMat)
      this.element.add(this._ringMesh)
    }

    this.renderHealthColor(score)
  } else {
    if (this._wasRoot || this._wasServer) {
      this.element.remove(this.mesh)
      delete this.mesh
      delete this._wasRoot
      delete this._wasServer
    }

    if (!this.mesh) {
      this.mesh = this.generateMesh(0.25, 0x666666)
      this.element.add(this.mesh)
      this.domPlane.position.y = -(0.25 + 0.4)
    }

    this.renderHealthColor(score)

    if (this.upstream !== this._lastUpstream) {
      this._nudge = this.body.position.clone()
      this._nudge = this._nudge.cross(new CANNON.Vec3(5, 5, 5))
    }
  }
}

NodeSingleView.prototype._renderCapacity = function () {
  if (!this.model || this.isRoot) return ''
  var health = this.model.data.health
  if (!health) return ''

  var down = health.downstreamCount || 0
  var cap, full

  if (this.isServer) {
    cap = this.superview && this.superview.serverCapacity
    full = this.superview && this.superview.serverAtCapacity
  } else {
    cap = this.superview && this.superview.globalK
    full = cap != null && down >= cap
  }

  if (cap == null) return ''
  var cls = full ? 'capacity full' : 'capacity'
  return '<span class="' + cls + '">↓' + down + '/' + cap + '</span>'
}

NodeSingleView.prototype.generateMesh = function (radius, color) {
  var geometry = new THREE.SphereGeometry(radius, 64, 64)
  var material = this.material = new THREE.MeshPhongMaterial({ color: color })
  var mesh = new THREE.Mesh(geometry, material)
  mesh.userData.id = this.model && this.model.id
  return mesh
}

NodeSingleView.prototype.renderHealthColor = function (score) {
  var color = null

  // Flash blue briefly on new upstream connection
  if (this.upstream && this.upstream !== this._lastUpstream) {
    color = 0x1AB6FF
    this._colorLock = true
    clearTimeout(this._colorLockTimer)
    this._colorLockTimer = setTimeout(function () {
      this._colorLock = false
      this.render()
    }.bind(this), 2000)
    this.mesh.material.color = new THREE.Color(color)
    return
  }

  if (this._colorLock) return

  var connected = this.upstream || this.isRoot || (this.model && this.model.data.transport === 'server')
  if (!connected) {
    color = 0x666666 // gray — disconnected
  } else if (score == null) {
    color = 0xFF8C19 // orange — connected but no score yet
  } else if (score >= 80) {
    color = 0x44CC44 // green — healthy
  } else if (score >= 50) {
    color = 0xFF8C19 // orange — moderate
  } else if (score >= 20) {
    color = 0xFFCC00 // yellow — degraded
  } else {
    color = 0xFF4444 // red — struggling
  }

  this.mesh.material.color = new THREE.Color(color)
}

NodeSingleView.prototype.preStep = function () {
  if (!this.superview) return
  this.body.quaternion.copy(this.superview.group.quaternion.clone().invert())
  this.body.quaternion.mult(this.superview.camera.quaternion, this.body.quaternion)

  if (this.isServer) {
    // Server node: position handled by enterFrame counter-rotation
    this.body.velocity.set(0, 0, 0)
    this.body.force.set(0, 0, 0)
    return
  }

  if (this.isRoot) {
    // Root is fixed: at P2P_ANCHOR when server exists, origin otherwise
    var targetPos = this.superview.hasServer ? this.superview.P2P_ANCHOR : ZERO_VEC
    this.body.position.set(targetPos.x, targetPos.y, targetPos.z)
    this.body.velocity.set(0, 0, 0)
    this.body.force.set(0, 0, 0)
    return
  }

  var anchor = this.getAnchor()
  var forces = []
  var force = null

  // Anchor Gravity: keep nodes from floating too far away
  var distToAnchor = this.body.position.distanceTo(anchor)
  if (distToAnchor > 2) {
    this._pullVec.set(
      anchor.x - this.body.position.x,
      anchor.y - this.body.position.y,
      anchor.z - this.body.position.z
    )
    forces.push(this._pullVec.scale(0.05))
  }

  for (var i in this.superview.subviews) {
    var peer = this.superview.subviews[i]
    if (peer !== this && peer.upstream !== this) {
      forces.push(this.enforcePeerGap(peer))
    }
  }

  force = ZERO_VEC

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
    var anchor = this.getAnchor()
    var upstreamDistanceToAnchor = peer.body.position.distanceTo(anchor)
    if (upstreamDistanceToAnchor > 0) {
      peer.body.position.vsub(anchor, this._tmpVec)
      target = anchor.vadd(this._tmpVec.scale((upstreamDistanceToAnchor + gap) / upstreamDistanceToAnchor))
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

NodeSingleView.prototype.getAnchor = function () {
  if (!this.superview.hasServer) return ZERO_VEC
  var transport = this.model && this.model.data.transport
  return (transport === 'server') ? this.superview.SERVER_ANCHOR : this.superview.P2P_ANCHOR
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

export default NodeSingleView
