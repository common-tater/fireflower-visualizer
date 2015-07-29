module.exports = NodeCollection

var inherits = require('inherits')
var Collection = require('../../lib/collection')

inherits(NodeCollection, Collection)

function NodeCollection (storage, Model) {
  Collection.call(this, storage, Model)
}

NodeCollection.prototype.sort = function () {
  var sorted = []
  var hasRoot = false
  var now = Date.now()

  for (var i in this.models) {
    var model = this.models[i]

    if (now - model.data.timestamp > 10000) {
      continue
    }

    if (model.data.root) {
      if (!hasRoot) {
        hasRoot = true
        sorted.push(model)
      }
    } else {
      sorted.push(model)
    }
  }

  return sorted
}
