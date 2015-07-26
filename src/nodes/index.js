module.exports = NodeIndexView

var famous = require('famous')
var inherits = require('inherits')
var CollectionView = require('../collection-view')
var NodeSingleView = require('./single')

var FamousEngine = famous.core.FamousEngine
var PhysicsEngine = famous.physics.PhysicsEngine
var Camera = famous.components.Camera
var DOMElement = famous.domRenderables.DOMElement
var Gravity3D = famous.physics.Gravity3D
var Vec3 = famous.math.Vec3

inherits(NodeIndexView, CollectionView)

function NodeIndexView () {
  this.ItemView = NodeSingleView
  this.element = FamousEngine.createScene('#node-index')
  this.physicsEngine = new PhysicsEngine()
  this.enterFrame = this.enterFrame.bind(this)

  // this.camera = new Camera(this.scene)
  // this.camera.setDepth(1000)

  CollectionView.call(this)

  this._onresize = this._onresize.bind(this)
  window.addEventListener('resize', this._onresize)
  this._onresize()

  FamousEngine.requestUpdateOnNextTick({
    onUpdate: this.enterFrame
  })
  FamousEngine.init()
}

NodeIndexView.prototype.addSubview = function (subview) {
  subview.element = this.element.addChild()
  CollectionView.prototype.addSubview.apply(this, arguments)
}

NodeIndexView.prototype.removeSubview = function (subview) {
  CollectionView.prototype.removeSubview.apply(this, arguments)
  this.element.removeChild(subview.element)
}

NodeIndexView.prototype.enterFrame = function (time) {
  this.physicsEngine.update(time)

  for (var i in this.subviews) {
    var subview = this.subviews[i]
    var physicalPosition = subview.particleElement.getPosition()
    subview.element.setPosition(physicalPosition.x, physicalPosition.y, physicalPosition.z)
  }

  FamousEngine.requestUpdateOnNextTick({
    onUpdate: this.enterFrame
  })
}

NodeIndexView.prototype._onresize = function () {
  //
}
