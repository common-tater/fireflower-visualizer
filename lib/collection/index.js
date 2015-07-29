module.exports = Collection

var events = require('events')
var inherits = require('inherits')
var Firebase = require('firebase')

function Collection (storage, Model) {
  this.storage = storage
  this.Model = Model || this.Model
  this.models = {}
  this.sorted = []

  this._onadd = this._onadd.bind(this)
  this._onremove = this._onremove.bind(this)
  this._onupdate = this._onupdate.bind(this)

  events.EventEmitter.call(this)
}
inherits(Collection, events.EventEmitter)

Collection.prototype.watch = function () {
  if (this.watching) return
  this.watching = true

  this._ref = this.storage

  var orderBy = this.orderBy
  if (orderBy) {
    this._ref = this._ref
      .orderByChild(orderBy)
  }

  var where = this.where
  if (where) {
    this._ref = this._ref
      .equalTo(where)
  }

  this._ref.on('child_added', this._onadd)
  this._ref.on('child_removed', this._onremove)

  // child_added won't trigger an update if the collection is empty
  this._ref.once('value', this._onupdate, function (err) {
    throw err // this would only happen if there was problem with rules
  })
}

Collection.prototype.unwatch = function (cb) {
  if (!this.watching) return
  this.watching = false

  this._ref.off('child_added', this._onadd)
  this._ref.off('child_removed', this._onremove)
}

Collection.prototype._onadd = function (snapshot) {
  var model = this.models[snapshot.key()] = new this.Model(snapshot.ref(), snapshot.val())
  model.on('update', this._onupdate)
  model.watch()
}

Collection.prototype._onremove = function (snapshot) {
  var key = snapshot.key()
  var model = this.models[key]
  if (model) {
    model.removeListener('update', this._onupdate)
    model.unwatch()
    delete this.models[key]
  }
}

Collection.prototype._onupdate = function (snapshot) {
  // if _onupdate was passed a snapshot, it means that it was
  // triggered by the empty collection safeguard (see .watch())
  // and if there is any data there to work with then
  // triggering this function is just not our job
  if (snapshot && snapshot.exists()) {
    return
  }

  this.sorted = this.sort()
  this.notFound = !this.sorted.length
  this.loaded = !this.notFound
  this.emit('update')
}

Collection.prototype.sort = function () {
  var sorted = []

  for (var i in this.models) {
    sorted.push(this.models[i])
  }

  return sorted
}
