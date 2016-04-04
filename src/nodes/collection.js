module.exports = NodeCollection

var inherits = require('inherits')
var Collection = require('../../lib/collection')
var realnow = null

inherits(NodeCollection, Collection)

function NodeCollection (storage, Model) {
  realnow = realnow || require('../../lib/realnow')(storage.parent().child('realnow'))
  Collection.call(this, storage.child('reports'), Model)
}

NodeCollection.prototype.sort = function () {
  var now = realnow()
  var nodes = {}

  this.hasRoot = false

  for (var i in this.models) {
    var peerModel = this.models[i]

    if (!peerModel.data.timestamp || now - peerModel.data.timestamp > 8000) {
      continue
    }

    if (peerModel.data.root) {
      if (!this.hasRoot) {
        this.hasRoot = true
        nodes[i] = peerModel
      }
    } else {
      nodes[i] = peerModel
    }
  }

  var sorted = []
  for (i in nodes) {
    sorted.push(nodes[i])
  }

  return sorted
}
