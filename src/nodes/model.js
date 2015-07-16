module.exports = NodeModel

var RealtimeModel = require('realtime-model')
var inherits = require('inherits')

inherits(NodeModel, RealtimeModel)

function NodeModel (storage, data) {
  RealtimeModel.call(this, storage, data)
}
