module.exports = NodeCollection

var inherits = require('inherits')
var Collection = require('../../lib/collection')
var realnow = null

inherits(NodeCollection, Collection)

function NodeCollection (storage, Model) {
  realnow = realnow || require('../../lib/realnow')(storage.parent().child('realnow'))
  Collection.call(this, storage, Model)
}

NodeCollection.prototype.sort = function () {
  var sorted = []
  var now = realnow()

  this.hasRoot = false

  for (var i in this.models) {
    var model = this.models[i]

    if (!model.data.timestamp || now - model.data.timestamp > 8000) {
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
