var Firebase = require('firebase')

var url = window.location.pathname.slice(1)
if (!url) {
  throw new Error('no flower selected')
}

var Collection = require('./src/nodes/collection')
var NodeModel = require('./src/nodes/model')
var NodeIndexView = require('./src/nodes')

var THREE = require('three')
THREE.CSS3DObject = require('./lib/three-css3drenderer')
THREE.TrackballControls = require('./lib/three-orbit-controls')

var db = new Firebase(url)
var nodeIndexView = new NodeIndexView()
nodeIndexView.collection = new Collection(db, NodeModel)
nodeIndexView.show()
