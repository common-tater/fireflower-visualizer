// Initialize Firebase from config
import Firebase from './lib/firebase-compat'
import firebaseConfig from './firebase-config'
Firebase.initializeApp(firebaseConfig)

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
