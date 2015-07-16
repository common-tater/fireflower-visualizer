module.exports = CollectionView

var hg = require('hyperglue2')

function CollectionView () {
  this.el = hg(this.template)
  this._rows = {}
  this._rowsEl = this.el.querySelector(this.rowsSelector)
  this.show = this.show.bind(this)
}

CollectionView.prototype.show = function (r) {
  if (!this.collection) {
    return
  }

  var loading = !this.collection.loaded && !this.collection.notFound
  var notFound = this.collection.notFound

  hg(this.el, {
    '.loader': {
      _class: {
        'hidden': !loading
      }
    },
    '.not-found': {
      _class: {
        'hidden': !notFound
      }
    },
    '.body': {
      _class: {
        'hidden': loading || notFound
      }
    }
  })

  var models = {}
  var sorted = this.collection.sorted
  var rows = this._rowsEl.childNodes
  var RowView = this.rowView

  // add new views
  for (var i in sorted) {
    var model = sorted[i]
    models[model.id] = model
    if (!this._rows[model.id]) {
      var row = this._rows[model.id] = new RowView()
      this._rowsEl.appendChild(row.el)
      row.el._rowid = model.id
      row.model = model
    }
  }

  // remove old views
  for (i = 0; i < rows.length; i++) {
    var el = rows[i]
    if (!models[el._rowid]) {
      row = this._rows[el._rowid]
      row.hide && row.hide()
      row.el.remove()
      delete this._rows[el._rowid]
    }
  }

  // sort views
  for (i = 0; i < sorted.length; i++) {
    model = sorted[i]
    el = rows[i]
    row = this._rows[model.id]
    if (el !== row.el) {
      this._rowsEl.insertBefore(row.el, el)
    }
    row.show()
  }

  return true
}

CollectionView.prototype.hide = function (r, cb) {
  if (this.collection) {
    this.collection.removeListener('update', this.render)
    this.collection.unwatch()
  }

  for (var i in this._rows) {
    var row = this._rows[i]
    row.hide && row.hide()
  }
}
