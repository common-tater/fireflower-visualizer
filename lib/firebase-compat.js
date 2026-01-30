// Firebase v9 compatibility shim
// Wraps Firebase v9 modular SDK to provide a legacy-like API
// for use with libraries that expect the old Firebase 2.x API

var firebaseApp = require('firebase/app')
var firebaseDb = require('firebase/database')

var app = null
var db = null

function FirebaseRef (database, path) {
  this._db = database
  this._path = path
  this._ref = firebaseDb.ref(database, path)
  this._listeners = {}
}

FirebaseRef.prototype.child = function (childPath) {
  return new FirebaseRef(this._db, this._path + '/' + childPath)
}

FirebaseRef.prototype.parent = function () {
  var parentPath = this._path.split('/').slice(0, -1).join('/')
  return new FirebaseRef(this._db, parentPath || '/')
}

FirebaseRef.prototype.key = function () {
  var parts = this._path.split('/')
  return parts[parts.length - 1]
}

FirebaseRef.prototype.push = function (data, onComplete) {
  var pushRef = firebaseDb.push(this._ref)
  var newRef = new FirebaseRef(this._db, this._path + '/' + pushRef.key)
  if (data !== undefined) {
    firebaseDb.set(pushRef, data).then(function () {
      if (onComplete) onComplete(null)
    }).catch(function (err) {
      if (onComplete) onComplete(err)
    })
  }
  return newRef
}

FirebaseRef.prototype.set = function (data, onComplete) {
  firebaseDb.set(this._ref, data).then(function () {
    if (onComplete) onComplete(null)
  }).catch(function (err) {
    if (onComplete) onComplete(err)
  })
}

FirebaseRef.prototype.update = function (data, onComplete) {
  firebaseDb.update(this._ref, data).then(function () {
    if (onComplete) onComplete(null)
  }).catch(function (err) {
    if (onComplete) onComplete(err)
  })
}

FirebaseRef.prototype.remove = function (onComplete) {
  firebaseDb.remove(this._ref).then(function () {
    if (onComplete) onComplete(null)
  }).catch(function (err) {
    if (onComplete) onComplete(err)
  })
}

FirebaseRef.prototype.on = function (eventType, callback, cancelCallback) {
  var self = this
  var handler

  if (eventType === 'value') {
    handler = firebaseDb.onValue(this._ref, function (snapshot) {
      callback(new SnapshotWrapper(self._db, snapshot))
    }, cancelCallback)
  } else if (eventType === 'child_added') {
    handler = firebaseDb.onChildAdded(this._ref, function (snapshot) {
      callback(new SnapshotWrapper(self._db, snapshot))
    }, cancelCallback)
  } else if (eventType === 'child_removed') {
    handler = firebaseDb.onChildRemoved(this._ref, function (snapshot) {
      callback(new SnapshotWrapper(self._db, snapshot))
    }, cancelCallback)
  } else if (eventType === 'child_changed') {
    handler = firebaseDb.onChildChanged(this._ref, function (snapshot) {
      callback(new SnapshotWrapper(self._db, snapshot))
    }, cancelCallback)
  }

  if (!this._listeners[eventType]) {
    this._listeners[eventType] = []
  }
  this._listeners[eventType].push({ callback: callback, unsubscribe: handler })
}

FirebaseRef.prototype.once = function (eventType, successCallback, failureCallback) {
  var self = this
  firebaseDb.get(this._ref).then(function (snapshot) {
    if (successCallback) successCallback(new SnapshotWrapper(self._db, snapshot))
  }).catch(function (err) {
    if (failureCallback) failureCallback(err)
  })
}

FirebaseRef.prototype.off = function (eventType, callback) {
  if (!eventType) {
    // Remove all listeners
    for (var type in this._listeners) {
      this._listeners[type].forEach(function (listener) {
        if (listener.unsubscribe) listener.unsubscribe()
      })
    }
    this._listeners = {}
  } else if (this._listeners[eventType]) {
    if (callback) {
      this._listeners[eventType] = this._listeners[eventType].filter(function (listener) {
        if (listener.callback === callback) {
          if (listener.unsubscribe) listener.unsubscribe()
          return false
        }
        return true
      })
    } else {
      this._listeners[eventType].forEach(function (listener) {
        if (listener.unsubscribe) listener.unsubscribe()
      })
      this._listeners[eventType] = []
    }
  }
}

FirebaseRef.prototype.orderByChild = function (childKey) {
  // Return a query wrapper (simplified - just returns self for now)
  return this
}

FirebaseRef.prototype.equalTo = function (value) {
  // Return a query wrapper (simplified - just returns self for now)
  return this
}

FirebaseRef.prototype.ref = function () {
  return this
}

function SnapshotWrapper (db, snapshot) {
  this._db = db
  this._snapshot = snapshot
}

SnapshotWrapper.prototype.val = function () {
  return this._snapshot.val()
}

SnapshotWrapper.prototype.key = function () {
  return this._snapshot.key
}

SnapshotWrapper.prototype.exists = function () {
  return this._snapshot.exists()
}

SnapshotWrapper.prototype.ref = function () {
  var path = this._snapshot.ref.toString().replace(this._db._repo.repoInfo_.toURLString(), '')
  return new FirebaseRef(this._db, path)
}

// ServerValue for timestamps
var ServerValue = {
  TIMESTAMP: { '.sv': 'timestamp' }
}

// Main constructor
function Firebase (url) {
  // Parse the URL to get the path
  // Legacy format: https://project.firebaseio.com/path
  // or just: path (if db already initialized)

  if (!db) {
    throw new Error('Firebase not initialized. Call Firebase.initializeApp first.')
  }

  var path = url
  if (url.indexOf('firebaseio.com') > -1 || url.indexOf('firebasedatabase.app') > -1) {
    var parts = url.split(/firebaseio\.com|firebasedatabase\.app/)
    path = parts[1] || '/'
  }

  return new FirebaseRef(db, path)
}

Firebase.initializeApp = function (config) {
  app = firebaseApp.initializeApp(config)
  db = firebaseDb.getDatabase(app)
  return app
}

Firebase.getDatabase = function () {
  return db
}

Firebase.ServerValue = ServerValue

module.exports = Firebase
