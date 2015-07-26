var Firebase = require('firebase')

var url = window.location.pathname.slice(1)
if (!url) {
  throw new Error('no flower selected')
}

var Collection = require('./src/nodes/collection')
var NodeModel = require('./src/nodes/model')
var NodeIndexView = require('./src/nodes')

var db = new Firebase(url + '/reports')
var nodeIndexView = new NodeIndexView()
nodeIndexView.collection = new Collection(db, NodeModel)
nodeIndexView.show()
