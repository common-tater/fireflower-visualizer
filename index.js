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

// --- Controls ---

// Reset button: clears all Firebase data
var resetBtn = document.getElementById('reset-btn')
resetBtn.addEventListener('click', function () {
  firebaseDb.remove(firebaseDb.ref(rawDb, dbPath + '/requests'))
  firebaseDb.remove(firebaseDb.ref(rawDb, dbPath + '/reports'))
})

// Server toggle: enables/disables the relay server via Firebase config
var serverToggle = document.getElementById('server-toggle')
var serverCheckbox = serverToggle.querySelector('input')
var configRef = firebaseDb.ref(rawDb, dbPath + '/configuration/serverEnabled')

// Read initial state
firebaseDb.onValue(configRef, function (snapshot) {
  var enabled = snapshot.val()
  if (enabled === null) enabled = true // default to enabled
  serverCheckbox.checked = enabled
  serverToggle.classList.toggle('active', enabled)
})

serverCheckbox.addEventListener('change', function () {
  var enabled = serverCheckbox.checked
  serverToggle.classList.toggle('active', enabled)
  firebaseDb.set(configRef, enabled)
})
