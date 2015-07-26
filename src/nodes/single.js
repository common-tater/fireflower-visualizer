module.exports = NodeSingleView

var famous = require('famous')
var DOMElement = famous.domRenderables.DOMElement
var Position = famous.components.Position
var Size = famous.components.Size
var Sphere = famous.physics.Sphere
var Vec3 = famous.math.Vec3
var Gravity3D = famous.physics.Gravity3D
var Mesh = require('famous/webgl-renderables/Mesh')
var Color = require('famous/utilities/Color')

function NodeSingleView () {
  this.update = this.update.bind(this)
}

NodeSingleView.prototype.show = function () {
  var isRoot = this.model.data.root
  var radius = isRoot ? 50 : 20
  var mass = isRoot ? 1000 : 20

  this.element
    .setMountPoint(0.5, 0.5)
    .setSizeMode('absolute', 'absolute')
    .setAbsoluteSize(
      radius * 2,
      radius * 2
    )

  this.domElement = new DOMElement(this.element, {
    content: this.model.id.slice(-5).toLowerCase(),
    properties: {
      'border-radius': '50%',
      'background-color': isRoot ? 'rgba(255,255,255,1)' : 'rgba(100,100,100,1)',
      'display': 'table-cell',
      'text-align': 'center',
      'vertical-align': 'middle'
    }
  })

  this.particleElement = new Sphere({
    mass: mass,
    radius: radius,
    restrictions: isRoot ? ['xy'] : []
  })

  if (isRoot) {
    this.particleElement.setPosition(window.innerWidth / 2, window.innerHeight / 2, 0)
    this.particleElement.setVelocity(0, 0, 0)
  } else {
    this.particleElement.setPosition(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 0)
    this.particleElement.setVelocity(random(20), random(20), random(20))
  }

  this.gravityElement = new Gravity3D(this.particleElement)

  this.superview.physicsEngine.add(this.particleElement)
  this.superview.physicsEngine.add(this.gravityElement)

  if (isRoot) {
    if (!this.superview.rootGravityElement) {
      this.superview.rootGravityElement = new Gravity3D(this.particleElement)
      for (var i in this.superview.subviews) {
        this.superview.rootGravityElement.addTarget(this.superview.subviews[i].particleElement)
      }
    }
  } else {
    if (this.superview.rootGravityElement) {
      this.superview.rootGravityElement.addTarget(this.particleElement)
    }
  }

  this.model.on('update', this.update)
  this.update()
}

NodeSingleView.prototype.update = function () {
  if (this.model.data.upstream) {
    if (this.upstream) {
      if (this.model.data.upstream === this.upstream.model.id) {
        return
      }
      this.disconnectUpstream()
    }

    this.upstream = this.superview.subviews[this.model.data.upstream]
    this.connectUpstream()
  } else {
    this.disconnectUpstream()
  }
}

NodeSingleView.prototype.connectUpstream = function () {
  if (this.upstream) {
    this.gravityElement.addTarget(this.upstream.particleElement)
    this.upstream.gravityElement.addTarget(this.particleElement)
    this.domElement.setContent(this.model.id.slice(-5).toLowerCase() + ' --> ' + this.model.data.upstream.slice(-5).toLowerCase())
  }
}

NodeSingleView.prototype.disconnectUpstream = function () {
  if (this.upstream) {
    this.gravityElement.removeTarget(this.upstream.particleElement)
    this.upstream.gravityElement.removeTarget(this.particleElement)
    this.domElement.setContent(this.model.id)
  }
}

NodeSingleView.prototype.hide = function () {
  this.model.removeListener('update', this.update)
  this.model.unwatch()

  this.superview.physicsEngine.remove(this.particleElement)
  this.superview.physicsEngine.remove(this.gravityElement)

  if (this.model.data.root) {
    this.superview.physicsEngine.remove(this.superview.rootGravityElement)
  }

  if (this.upstream) {
    this.disconnectUpstream()
  }
}

function random (max) {
  return -max + Math.random() * max * 2
}
