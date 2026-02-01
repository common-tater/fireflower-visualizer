// Initialize Firebase from config
import Firebase from './lib/firebase-compat'
import firebaseConfig from './firebase-config'
Firebase.initializeApp(firebaseConfig)

var firebaseDb = require('firebase/database')
var rawDb = Firebase.getDatabase()

// Extract database path from URL pathname
var dbPath = window.location.pathname.slice(1)
if (!dbPath) {
  dbPath = 'tree' // Default path matching fireflower example
}

import Collection from './src/nodes/collection'
import NodeModel from './src/nodes/model'
import NodeIndexView from './src/nodes'

// Create ref to reports path
var db = new Firebase(dbPath + '/reports')
var nodeIndexView = new NodeIndexView()
nodeIndexView.collection = new Collection(db, NodeModel)
nodeIndexView.show()

// ── Read-only config display ──

// Watch K from Firebase config
var configKEl = document.getElementById('config-k')
if (configKEl) {
  var kRef = firebaseDb.ref(rawDb, dbPath + '/configuration/K')
  firebaseDb.onValue(kRef, function (snapshot) {
    var k = snapshot.val()
    configKEl.textContent = k != null ? k : '–'
  })
}

// Watch serverCapacity from Firebase config
var configCapacityEl = document.getElementById('config-server-capacity')
if (configCapacityEl) {
  var capacityRef = firebaseDb.ref(rawDb, dbPath + '/configuration/serverCapacity')
  firebaseDb.onValue(capacityRef, function (snapshot) {
    var capacity = snapshot.val()
    configCapacityEl.textContent = capacity || '∞'
  })
}

// ── Read-only stats from reports ──

var statNodesEl = document.getElementById('stat-nodes')
var statP2pEl = document.getElementById('stat-p2p')
var statServerEl = document.getElementById('stat-server')

if (statNodesEl) {
  var reportsRef = firebaseDb.ref(rawDb, dbPath + '/reports')
  firebaseDb.onValue(reportsRef, function (snapshot) {
    var reports = snapshot.val()
    if (!reports) {
      statNodesEl.textContent = '0'
      statP2pEl.textContent = '0'
      statServerEl.textContent = '0'
      return
    }

    var now = Date.now()
    var total = 0
    var p2p = 0
    var server = 0

    for (var id in reports) {
      var report = reports[id]
      // Only count recently-active nodes (within 8s, matching collection.js)
      if (!report.timestamp || now - report.timestamp > 8000) continue
      total++
      if (report.transport === 'server') server++
      else if (report.transport === 'p2p') p2p++
    }

    statNodesEl.textContent = total
    statP2pEl.textContent = p2p
    statServerEl.textContent = server
  })
}
