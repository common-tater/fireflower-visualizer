module.exports = NodeSingleView

var hg = require('hyperglue2')

function NodeSingleView () {
  this.el = hg(require('./single.html'))
  this.show = this.show.bind(this)
}

NodeSingleView.prototype.show = function () {
  hg(this.el, this.model.id + ' -> ' + this.model.data.upstream)
}

NodeSingleView.prototype.hide = function () {
  //
}
