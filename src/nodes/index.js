import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import CANNON from 'cannon'
import inherits from 'inherits'
import CollectionView from '../../lib/collection-view'
import NodeSingleView from './single'


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

  this.domRenderer = new CSS3DRenderer()
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

  this.controls = new TrackballControls(this.camera, this.webglRenderer.domElement)
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

  // P2P connections (gray)
  this._p2pPositions = new Float32Array(this.maxConnections * 2 * 3)
  var p2pGeometry = new THREE.BufferGeometry()
  var p2pAttribute = new THREE.BufferAttribute(this._p2pPositions, 3)
  p2pAttribute.setUsage(THREE.DynamicDrawUsage)
  p2pGeometry.setAttribute('position', p2pAttribute)
  p2pGeometry.computeBoundingSphere()

  this.p2pConnections = new THREE.LineSegments(p2pGeometry, new THREE.LineBasicMaterial({
    color: 0x444444,
    linewidth: 1.5
  }))
  this.group.add(this.p2pConnections)

  // Server connections (cyan)
  this._serverPositions = new Float32Array(this.maxConnections * 2 * 3)
  var serverGeometry = new THREE.BufferGeometry()
  var serverAttribute = new THREE.BufferAttribute(this._serverPositions, 3)
  serverAttribute.setUsage(THREE.DynamicDrawUsage)
  serverGeometry.setAttribute('position', serverAttribute)
  serverGeometry.computeBoundingSphere()

  this.serverConnections = new THREE.LineSegments(serverGeometry, new THREE.LineBasicMaterial({
    color: 0x44DD44,
    linewidth: 2.0
  }))
  this.group.add(this.serverConnections)

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

  var p2pCount = 0
  var serverCount = 0
  var maxPositions = this.maxConnections * 2 * 3

  for (var i = 0; i < maxPositions; i++) {
    this._p2pPositions[i] = 0
    this._serverPositions[i] = 0
  }

  // Find the server subview if it exists
  var serverSubview = null
  for (var s in this.subviews) {
    if (this.subviews[s].isServer) {
      serverSubview = this.subviews[s]
      break
    }
  }

  // Counter-rotate server node so it stays fixed in world space
  if (serverSubview) {
    var fixedWorldPos = new THREE.Vector3(-6, 2, 0)
    var inverseQuat = this.group.quaternion.clone().invert()
    serverSubview.element.position.copy(fixedWorldPos.applyQuaternion(inverseQuat))
    serverSubview.element.quaternion.copy(serverSubview.body.quaternion)
  }

  for (var i in this.subviews) {
    var subview = this.subviews[i]
    if (subview.isServer) continue // position handled above
    subview.element.position.copy(subview.body.position)
    subview.element.quaternion.copy(subview.body.quaternion)
    subview.body.velocity = subview.body.velocity.scale(0.75)

    var isServer = subview.model && subview.model.data.transport === 'server'
    var target

    if (isServer && serverSubview) {
      // Server-connected nodes draw lines to the server node
      target = serverSubview.element
    } else if (subview.upstream) {
      target = subview.upstream.element
    } else {
      target = subview.element
    }

    var positions = isServer ? this._serverPositions : this._p2pPositions
    var idx = isServer ? serverCount : p2pCount

    positions[idx * 6] = target.position.x
    positions[idx * 6 + 1] = target.position.y
    positions[idx * 6 + 2] = target.position.z
    positions[idx * 6 + 3] = subview.element.position.x
    positions[idx * 6 + 4] = subview.element.position.y
    positions[idx * 6 + 5] = subview.element.position.z

    if (isServer) serverCount++
    else p2pCount++
  }

  this.p2pConnections.geometry.attributes.position.needsUpdate = true
  this.serverConnections.geometry.attributes.position.needsUpdate = true
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

export default NodeIndexView
