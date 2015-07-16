module.exports = NodeIndexView

var CollectionView = require('../collection/view')
var NodeSingleView = require('./single')
var inherits = require('inherits')

inherits(NodeIndexView, CollectionView)

function NodeIndexView () {
  this.template = require('./index.html')
  this.rowView = NodeSingleView
  this.rowsSelector = '#rows'
  CollectionView.call(this)
}
