module.exports = View

function View () {
  this.subviews = {}
}

View.prototype.addSubview = function (subview) {
  subview.superview = this
  subview.id = subview.model ? subview.model.id : (Math.random() + '').slice(2)
  this.subviews[subview.id] = subview
}

View.prototype.removeSubview = function (subview) {
  delete subview.superview
  delete this.subviews[subview.id]
}

View.prototype.hide = function () {
  for (var id in this.subviews) {
    this.removeSubview(this.subviews[id])
  }
}
