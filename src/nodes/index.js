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
  this.setupClickEvents()

  window.addEventListener('resize', this.onresize)
  this.onresize()
  this.enterFrame()

  this._refreshInterval = setInterval(function () {
    if (Date.now() - this._lastUpdate > 8000) {
      this.collection._onupdate()
    }
  }.bind(this), 1000)
}

NodeIndexView.prototype.update = function () {
  this._lastUpdate = Date.now()
  CollectionView.prototype.update.apply(this, arguments)
  this.rootNode.element.visible = this.rootNode.domElement.visible = !this.collection.hasRoot
}

NodeIndexView.prototype.setupPhysics = function () {
  this.world = new CANNON.World()
  this.world.gravity.set(0, 0, 0)
  this.world.broadphase = new CANNON.NaiveBroadphase()
  this.world.solver.iterations = 10
  this.timeStep = 1 / 60
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
  this._connectionsPositions = new Float32Array(this.maxConnections * 2 * 3)

  var geometry = new THREE.BufferGeometry()
  geometry.addAttribute('position', new THREE.DynamicBufferAttribute(this._connectionsPositions, 3))
  geometry.computeBoundingSphere()

  var material = new THREE.LineBasicMaterial({
    color: 0x444444,
    linewidth: 1.5
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

NodeIndexView.prototype.setupClickEvents = function () {
  this.raycaster = new THREE.Raycaster()
  this.clickVector = new THREE.Vector3()
  this.element.addEventListener('click', function (evt) {
    this._click = {
      x: evt.clientX,
      y: evt.clientY
    }
  }.bind(this))
}

NodeIndexView.prototype.enterFrame = function () {
  this.world.step(this.timeStep)

  if (this._click) {
    this.handleClick(this._click)
    delete this._click
  }

  this.controls.update()
  if (!this.controls.active) {
    this.group.rotation.y += 0.005
  }

  this.rootNode.element.position.copy(this.rootNode.body.position)
  this.rootNode.element.quaternion.copy(this.rootNode.body.quaternion)

  var connectionCount = 0

  for (var i = 0; i < this.maxConnections * 8; i++) {
    this._connectionsPositions[i] = 0
  }

  for (var i in this.subviews) {
    var subview = this.subviews[i]
    subview.element.position.copy(subview.body.position)
    subview.element.quaternion.copy(subview.body.quaternion)
    subview.body.velocity = subview.body.velocity.scale(0.75)

    var target = subview.upstream ? subview.upstream.element : subview.element
    this._connectionsPositions[connectionCount * 6] = target.position.x
    this._connectionsPositions[connectionCount * 6 + 1] = target.position.y
    this._connectionsPositions[connectionCount * 6 + 2] = target.position.z
    this._connectionsPositions[connectionCount * 6 + 3] = subview.element.position.x
    this._connectionsPositions[connectionCount * 6 + 4] = subview.element.position.y
    this._connectionsPositions[connectionCount * 6 + 5] = subview.element.position.z

    connectionCount++
  }

  this.connections.geometry.attributes.position.needsUpdate = true
  this.webglRenderer.render(this.scene, this.camera)
  this.domRenderer.render(this.scene, this.camera)

  window.requestAnimationFrame(this.enterFrame)
}

NodeIndexView.prototype.handleClick = function (click) {
  this.clickVector.x = (click.x / this.element.clientWidth) * 2 - 1
  this.clickVector.y = -(click.y / this.element.clientHeight) * 2 + 1
  this.clickVector.unproject(this.camera)
  this.clickVector.sub(this.camera.position)
  this.clickVector.normalize()

  this.raycaster.set(this.camera.position, this.clickVector)
  var contact = this.raycaster.intersectObjects(this.scene.children, true)
  if (contact.length) {
    var target = contact.slice(-1)[0].object
    var id = target.userData.id
    if (id) {
      console.log(this.subviews[id].model.data.data)
    }
  }
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
