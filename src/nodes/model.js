module.exports = NodeModel

var RealtimeModel = require('realtime-model')
var inherits = require('inherits')

inherits(NodeModel, RealtimeModel)

function NodeModel (storage, data) {
  RealtimeModel.call(this, storage, data)
}

NodeModel.prototype._onupdate = function (snapshot) {
  if (snapshot.val()) {
    this.data = snapshot.val()
  }

  RealtimeModel.prototype._onupdate.call(this, snapshot)
}
