module.exports = CollectionView

var inherits = require('inherits')
var View = require('../view')

inherits(CollectionView, View)

function CollectionView () {
  this.update = this.update.bind(this)
  View.call(this)
}

CollectionView.prototype.show = function () {
  if (!this.collection) {
    return
  }

  if (this.collection.listeners('update').indexOf(this.update) === -1) {
    this.collection.on('update', this.update)
    this.collection.watch()
  }
}

CollectionView.prototype.update = function () {
  var sorted = this.collection.sorted
  var i, model, subview, expected, tokeep = {}

  // add new items
  for (i in sorted) {
    model = sorted[i]
    tokeep[model.id] = true
    if (!this.subviews[model.id]) {
      subview = new this.ItemView()
      subview.model = model
      subview.collection = this.collection
      this.addSubview(subview)
      if (!this.insertSubview) {
        subview.show()
      }
    }
  }

  // remove old items
  for (i in this.subviews) {
    subview = this.subviews[i]
    if (subview.model && !tokeep[subview.model.id]) {
      if (!this.collection.models[subview.model.id]) {
        delete subview.collection
      }
      subview.hide()
      this.removeSubview(subview)
    }
  }

  // sort items
  if (this.insertSubview) {
    for (i = 0; i < sorted.length; i++) {
      model = sorted[i]
      subview = this.subviews[model.id]
      expected = this.subviewAtIndex(i)
      if (subview !== expected) {
        this.insertSubview(subview, expected)
        subview.show()
      }
    }
  }
}

CollectionView.prototype.hide = function () {
  if (this.collection) {
    this.collection.removeListener('update', this.update)
    this.collection.unwatch()
  }

  View.prototype.hide.apply(this, arguments)
}
