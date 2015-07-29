module.exports = NodeCollection

var inherits = require('inherits')
var Collection = require('../../lib/collection')

inherits(NodeCollection, Collection)

function NodeCollection (storage, Model) {
  Collection.call(this, storage, Model)
}

NodeCollection.prototype.sort = function () {
  var sorted = []
  var now = Date.now()

  this.hasRoot = false

  for (var i in this.models) {
    var model = this.models[i]

    if (now - model.data.timestamp > 8000) {
      continue
    }

    if (model.data.root) {
      if (!this.hasRoot) {
        this.hasRoot = true
        sorted.push(model)
      }
    } else {
      sorted.push(model)
    }
  }

  return sorted
}
