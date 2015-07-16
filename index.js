var Firebase = require('firebase')

var url = window.location.pathname.slice(1)
if (!url) {
  throw new Error('no flower selected')
} else {
  var parts = url.split('/')
  parts.splice(1, 0, 'flowers')
  url = parts.join('/')
}

var Collection = require('./src/collection')
var NodeModel = require('./src/nodes/model')
var NodeIndexView = require('./src/nodes')

var db = new Firebase(url + '/reports')
var nodeIndexView = new NodeIndexView()

nodeIndexView.collection = new Collection(db, NodeModel)
nodeIndexView.collection.watch()
nodeIndexView.collection.on('update', nodeIndexView.show)
nodeIndexView.show()

document.querySelector('body').appendChild(nodeIndexView.el)
