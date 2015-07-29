module.exports = NodeIndexView

var THREE = require('three')
var CANNON = require('cannon')
var inherits = require('inherits')
var CollectionView = require('../../lib/collection-view')
var NodeSingleView = require('./single')

inherits(NodeIndexView, CollectionView)

function NodeIndexView () {
  this.ItemView = NodeSingleView
  this.element = document.querySelector('#node-index')
  this.onresize = this.onresize.bind(this)
  this.enterFrame = this.enterFrame.bind(this)

  CollectionView.call(this)

  this.setupPhysics()
  this.setupRendering()
  this.setupLights()
  this.setupCamera()
  this.setupConnectionGraph()

  window.addEventListener('resize', this.onresize)
  this.onresize()
  this.enterFrame()
}

NodeIndexView.prototype.setupPhysics = function () {
  this.world = new CANNON.World()
  this.world.gravity.set(0, 0, 0)
  this.world.broadphase = new CANNON.NaiveBroadphase()
  this.world.solver.iterations = 10

  this.timeStep = 1 / 60
  this.bounds = {
    x: 20,
    y: 10,
    z: 5
  }
}

NodeIndexView.prototype.setupRendering = function () {
  this.scene = new THREE.Scene()
  this.group = new THREE.Group()
  this.scene.add(this.group)

  this.domRenderer = new THREE.CSS3DRenderer()
  this.element.querySelector('#dom')
    .appendChild(this.domRenderer.domElement)

  this.webglRenderer = new THREE.WebGLRenderer({
    canvas: this.element.querySelector('#webgl'),
    antiAlias: true,
    alpha: true
  })
  this.webglRenderer.setPixelRatio(window.devicePixelRatio)
  this.webglRenderer.setClearColor(0x222222, 0)
}

NodeIndexView.prototype.setupLights = function () {
  this.ambientLight = new THREE.AmbientLight(0xDDDDDD)
  this.scene.add(this.ambientLight)

  this.mainLight = new THREE.PointLight(0xFFFFFF, 0.1, 0)
  this.mainLight.position.set(100, 100, 100)
  this.scene.add(this.mainLight)

  this.backgroundLight = new THREE.PointLight(0xFFFFFF, 0.01, 0)
  this.backgroundLight.position.set(-100, -100, -100)
  this.scene.add(this.backgroundLight)
}

NodeIndexView.prototype.setupCamera = function () {
  this.camera = new THREE.PerspectiveCamera(28, this.element.clientWidth / this.element.clientHeight, 1, 1000)
  this.camera.position.z = 35
  this.scene.add(this.camera)

  this.controls = new THREE.TrackballControls(this.camera, this.webglRenderer.domElement)
  this.controls.rotateSpeed = 1.0
  this.controls.zoomSpeed = 1.2
  this.controls.panSpeed = 0.2
  this.controls.noZoom = false
  this.controls.noPan = false
  this.controls.staticMoving = false
  this.controls.dynamicDampingFactor = 0.3
  this.controls.minDistance = 0.0
  this.controls.maxDistance = 100 * 1000
}

NodeIndexView.prototype.setupConnectionGraph = function () {
  this.maxConnections = 512
  this._connectionsBuffer = new Float32Array(this.maxConnections * 3)

  var geometry = new THREE.BufferGeometry()
  geometry.addAttribute('position', new THREE.DynamicBufferAttribute(this._connectionsBuffer, 3))
  geometry.computeBoundingSphere()

  var material = new THREE.LineBasicMaterial({
    color: 0x333333
  })

  this.connections = new THREE.Line(geometry, material, THREE.LinePieces)
  this.group.add(this.connections)

  this.rootNode = new this.ItemView()
  this.rootNode.isRoot = true
  this.rootNode.superview = this
  this.world.add(this.rootNode.body)
  this.group.add(this.rootNode.element)
  this.rootNode.show()
}

NodeIndexView.prototype.enterFrame = function () {
  this.world.step(this.timeStep)
  this.group.rotation.y += 0.005

  var connectionCount = 0

  for (var i in this.subviews) {
    var subview = this.subviews[i]

    subview.element.position.copy(subview.body.position)
    subview.element.quaternion.copy(subview.body.quaternion)
    subview.body.velocity = subview.body.velocity.scale(0.75)

    if (subview.upstream) {
      this._connectionsBuffer[connectionCount * 6] = subview.upstream.element.position.x
      this._connectionsBuffer[connectionCount * 6 + 1] = subview.upstream.element.position.y
      this._connectionsBuffer[connectionCount * 6 + 2] = subview.upstream.element.position.z
    } else {
      this._connectionsBuffer[connectionCount * 6] = this.rootNode.element.position.x
      this._connectionsBuffer[connectionCount * 6 + 1] = this.rootNode.element.position.y
      this._connectionsBuffer[connectionCount * 6 + 2] = this.rootNode.element.position.z
    }

    this._connectionsBuffer[connectionCount * 6 + 3] = subview.element.position.x
    this._connectionsBuffer[connectionCount * 6 + 4] = subview.element.position.y
    this._connectionsBuffer[connectionCount * 6 + 5] = subview.element.position.z

    connectionCount++
  }

  for (var i = connectionCount * 6; i < this.maxConnections; i++) {
    this._connectionsBuffer[i] = 0
  }
  this.connections.geometry.attributes.position.needsUpdate = connectionCount > 0

  this.controls.update()
  this.webglRenderer.render(this.scene, this.camera)
  this.domRenderer.render(this.scene, this.camera)

  window.requestAnimationFrame(this.enterFrame)
}

NodeIndexView.prototype.onresize = function () {
  this.controls.screen.width = this.element.clientWidth
  this.controls.screen.height = this.element.clientHeight

  this.camera.aspect = this.element.clientWidth / this.element.clientHeight
  this.camera.updateProjectionMatrix()

  this.domRenderer.setSize(this.element.clientWidth, this.element.clientHeight)
  this.webglRenderer.setSize(this.element.clientWidth, this.element.clientHeight)
}

NodeIndexView.prototype.addSubview = function (subview) {
  this.world.add(subview.body)
  this.group.add(subview.element)
  CollectionView.prototype.addSubview.apply(this, arguments)
}

NodeIndexView.prototype.removeSubview = function (subview) {
  CollectionView.prototype.removeSubview.apply(this, arguments)
  this.group.remove(subview.element)
  this.world.remove(subview.body)
}
