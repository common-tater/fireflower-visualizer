var Firebase = require('firebase')

var url = window.location.pathname.slice(1)
if (!url) {
  throw new Error('no flower selected')
}

var Collection = require('./src/nodes/collection')
var NodeModel = require('./src/nodes/model')
var NodeIndexView = require('./src/nodes')

var THREE = require('three')
require('./lib/three-css3drenderer')(THREE)
require('./lib/three-orbit-controls')(THREE)

var db = new Firebase(url + '/reports')
var nodeIndexView = new NodeIndexView()
nodeIndexView.collection = new Collection(db, NodeModel)
nodeIndexView.show()
