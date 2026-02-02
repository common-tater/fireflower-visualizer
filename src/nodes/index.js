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
  this.setupOverlay()

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
  var showPlaceholder = !this.collection.hasRoot
  this.rootNode.element.visible = showPlaceholder
  this.rootNode.domElement.visible = showPlaceholder
  this.rootNode.labelElement.style.display = showPlaceholder ? '' : 'none'
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

  // World Anchors (Physics-Safe CANNON.Vec3)
  this.P2P_ANCHOR = new CANNON.Vec3(6, 0, 0)
  this.SERVER_ANCHOR = new CANNON.Vec3(-6, 0, 0)
  this.ZERO_VEC = new CANNON.Vec3(0, 0, 0)
  this.serverCount = 0
  this.p2pCount = 0
  this.hasServer = false // true when the server node itself exists (not transport count)

  this.rootNode.show()
}

NodeIndexView.prototype.setupOverlay = function () {
  this._statNodes = document.getElementById('stat-nodes')
  this._statP2p = document.getElementById('stat-p2p')
  this._statServer = document.getElementById('stat-server')
  this._uiNodeCount = document.getElementById('ui-node-count')
}

NodeIndexView.prototype.updateOverlay = function (p2pCount, serverCount) {
  var nodeCount = Object.keys(this.subviews).length
  if (this._statNodes) this._statNodes.textContent = nodeCount
  if (this._statP2p) this._statP2p.textContent = p2pCount
  if (this._statServer) this._statServer.textContent = serverCount
  if (this._uiNodeCount) {
    this._uiNodeCount.innerHTML = '<strong>' + nodeCount + '</strong> node' + (nodeCount !== 1 ? 's' : '') + ' online'
  }
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
  var p2pCount = 0
  var serverCount = 0

  // Pre-calculate counts so subviews have accurate context during preStep
  for (var id in this.subviews) {
    if (this.subviews[id].model && this.subviews[id].model.data.transport === 'server') {
      serverCount++
    } else {
      p2pCount++
    }
  }
  this.serverCount = serverCount
  this.p2pCount = p2pCount

  this.world.step(this.timeStep)

  if (this._click) {
    this.handleClick(this._click)
    delete this._click
  }

  this.controls.update()
  if (!this.controls.active) {
    this.group.rotation.y += 0.005
  }

  p2pCount = 0
  serverCount = 0
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
  this.hasServer = !!serverSubview

  // Counter-rotate fixed nodes (root + server) so they stay fixed in world space
  // while the group rotates. Peer nodes orbit with the group.
  var inverseQuat = this.group.quaternion.clone().invert()

  // Root: fixed at P2P_ANCHOR (right) when server exists, origin otherwise
  var rootWorldPos = this.hasServer ? this.P2P_ANCHOR : this.ZERO_VEC
  var rootPos = new THREE.Vector3(rootWorldPos.x, rootWorldPos.y, rootWorldPos.z).applyQuaternion(inverseQuat)
  this.rootNode.element.position.copy(rootPos)
  this.rootNode.body.position.set(rootPos.x, rootPos.y, rootPos.z)
  this.rootNode.element.quaternion.copy(this.rootNode.body.quaternion)

  // Server: fixed at SERVER_ANCHOR (left)
  if (serverSubview) {
    var serverPos = new THREE.Vector3(this.SERVER_ANCHOR.x, this.SERVER_ANCHOR.y, this.SERVER_ANCHOR.z).applyQuaternion(inverseQuat)
    serverSubview.element.position.copy(serverPos)
    serverSubview.body.position.set(serverPos.x, serverPos.y, serverPos.z)
    serverSubview.element.quaternion.copy(serverSubview.body.quaternion)
  }

  // Draw server-to-root connection line (green, same as server connections)
  if (serverSubview) {
    var serverTarget = serverSubview.upstream ? serverSubview.upstream.element : this.rootNode.element
    this._serverPositions[serverCount * 6] = serverTarget.position.x
    this._serverPositions[serverCount * 6 + 1] = serverTarget.position.y
    this._serverPositions[serverCount * 6 + 2] = serverTarget.position.z
    this._serverPositions[serverCount * 6 + 3] = serverSubview.element.position.x
    this._serverPositions[serverCount * 6 + 4] = serverSubview.element.position.y
    this._serverPositions[serverCount * 6 + 5] = serverSubview.element.position.z
    serverCount++
  }

  for (var i in this.subviews) {
    var subview = this.subviews[i]
    if (subview.isServer) continue // position handled above, line drawn above

    // Root subview: counter-rotate to stay fixed in world space, like server
    if (subview.isRoot) {
      var rootWorldPos = this.hasServer ? this.P2P_ANCHOR : this.ZERO_VEC
      var rPos = new THREE.Vector3(rootWorldPos.x, rootWorldPos.y, rootWorldPos.z).applyQuaternion(inverseQuat)
      subview.element.position.copy(rPos)
      subview.body.position.set(rPos.x, rPos.y, rPos.z)
      subview.element.quaternion.copy(subview.body.quaternion)
    } else {
      subview.element.position.copy(subview.body.position)
      subview.element.quaternion.copy(subview.body.quaternion)
      subview.body.velocity = subview.body.velocity.scale(0.75)
    }

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

  this.updateOverlay(p2pCount, serverCount)

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
  // Scatter new peers in 3D so they don't collapse to a 2D plane
  subview.body.position.set(
    -2 + Math.random() * 4,
    -2 + Math.random() * 4,
    -2 + Math.random() * 4
  )
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
