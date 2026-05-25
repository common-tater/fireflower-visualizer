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

// ── Overlay Elements ──
var infoOverlay = document.getElementById('node-info-overlay')
var infoId = document.getElementById('node-info-id')
var infoUsername = document.getElementById('node-info-username')
var infoTransport = document.getElementById('node-info-transport')
var infoUpstream = document.getElementById('node-info-upstream')
var infoLevel = document.getElementById('node-info-level')
var infoScore = document.getElementById('node-info-score')
var infoDownstream = document.getElementById('node-info-downstream')
var infoRtt = document.getElementById('node-info-rtt')
var infoDropRate = document.getElementById('node-info-droprate')
var overlayClose = document.getElementById('overlay-close')

if (overlayClose) {
  overlayClose.onclick = function () {
    if (infoOverlay) infoOverlay.classList.remove('active')
  }
}

// ── Read-only config display ──

// Watch K from Firebase config
var configKEl = document.getElementById('config-k')
var kRef = firebaseDb.ref(rawDb, dbPath + '/configuration/K')
firebaseDb.onValue(kRef, function (snapshot) {
  var k = snapshot.val()
  if (configKEl) configKEl.textContent = k != null ? k : '–'
  nodeIndexView.globalK = k
})

// Watch serverCapacity from Firebase config
var configCapacityEl = document.getElementById('config-server-capacity')
var capacityRef = firebaseDb.ref(rawDb, dbPath + '/configuration/serverCapacity')
firebaseDb.onValue(capacityRef, function (snapshot) {
  var capacity = snapshot.val()
  if (configCapacityEl) configCapacityEl.textContent = capacity || '∞'
  nodeIndexView.serverCapacity = capacity
})

// Watch serverAtCapacity from Firebase config
var atCapacityRef = firebaseDb.ref(rawDb, dbPath + '/configuration/serverAtCapacity')
firebaseDb.onValue(atCapacityRef, function (snapshot) {
  nodeIndexView.serverAtCapacity = !!snapshot.val()
})

// ── Read-only stats from reports ──

var statNodesEl = document.getElementById('stat-nodes')
var statP2pEl = document.getElementById('stat-p2p')
var statServerEl = document.getElementById('stat-server')

if (statNodesEl) {
  var reportsRef = firebaseDb.ref(rawDb, dbPath + '/reports')

  // Cache for stats elements
  var statDisconnectedEl = document.getElementById('stat-disconnected')
  var statDepthEl = document.getElementById('stat-depth')
  var healthCountEls = {
    healthy: document.getElementById('health-healthy'),
    moderate: document.getElementById('health-moderate'),
    degraded: document.getElementById('health-degraded'),
    struggling: document.getElementById('health-struggling')
  }
  var healthAvgEl = document.getElementById('health-avg')

  firebaseDb.onValue(reportsRef, function (snapshot) {
    var reports = snapshot.val()
    if (!reports) {
      statNodesEl.textContent = '0'
      statP2pEl.textContent = '0'
      statServerEl.textContent = '0'
      if (statDisconnectedEl) statDisconnectedEl.textContent = '0'
      return
    }

    var now = Date.now()
    var stats = {
      total: 0, p2p: 0, server: 0, disconnected: 0,
      maxDepth: 0, sumHealth: 0, healthCount: 0,
      sumRtt: 0, rttCount: 0, sumDropRate: 0, dropRateCount: 0,
      buckets: { healthy: 0, moderate: 0, degraded: 0, struggling: 0 }
    }

    for (var id in reports) {
      var report = reports[id]
      // Only count recently-active nodes (within 8s)
      if (!report.timestamp || now - report.timestamp > 8000) continue

      stats.total++
      if (report.transport === 'server') stats.server++
      else if (report.transport === 'p2p') stats.p2p++

      // Disconnected: has no upstream and is not root and not server node
      var isDisconnected = !report.upstream && !report.root && report.transport !== 'server'
      if (isDisconnected) stats.disconnected++

      // Depth (ignore sentinel value 0x10000 / 65536)
      if (report.health && report.health.level < 0x10000 && report.health.level > stats.maxDepth) {
        stats.maxDepth = report.health.level
      }

      // Health buckets
      if (report.health && report.health.score != null) {
        var s = report.health.score
        stats.sumHealth += s
        stats.healthCount++
        if (s >= 80) stats.buckets.healthy++
        else if (s >= 50) stats.buckets.moderate++
        else if (s >= 20) stats.buckets.degraded++
        else stats.buckets.struggling++
      }

      if (report.health && report.health.rtt != null) {
        stats.sumRtt += report.health.rtt
        stats.rttCount++
      }
      if (report.health && report.health.dropRate != null) {
        stats.sumDropRate += report.health.dropRate
        stats.dropRateCount++
      }
    }

    // Update Network panel
    statNodesEl.textContent = stats.total
    statP2pEl.textContent = stats.p2p
    statServerEl.textContent = stats.server
    if (statDisconnectedEl) {
      statDisconnectedEl.textContent = stats.disconnected
      if (stats.disconnected > 0) {
        statDisconnectedEl.classList.add('alert')
        statDisconnectedEl.parentElement.classList.add('alert')
      } else {
        statDisconnectedEl.classList.remove('alert')
        statDisconnectedEl.parentElement.classList.remove('alert')
      }
    }
    if (statDepthEl) statDepthEl.textContent = stats.maxDepth

    // Update Health panel
    for (var key in healthCountEls) {
      if (healthCountEls[key]) healthCountEls[key].textContent = stats.buckets[key]
    }
    if (healthAvgEl) {
      var avg = stats.healthCount > 0 ? Math.round(stats.sumHealth / stats.healthCount) : 0
      healthAvgEl.textContent = avg
    }

    var statRttEl = document.getElementById('stat-rtt')
    if (statRttEl) {
      statRttEl.textContent = stats.rttCount > 0 ? Math.round(stats.sumRtt / stats.rttCount) + 'ms' : '–'
    }
    var statDropRateEl = document.getElementById('stat-droprate')
    if (statDropRateEl) {
      statDropRateEl.textContent = stats.dropRateCount > 0 ? (stats.sumDropRate / stats.dropRateCount * 100).toFixed(1) + '%' : '0%'
    }
  })
}

// ── Node Interaction Layer ──

// Patch NodeIndexView to show overlay on click
var originalHandleClick = nodeIndexView.handleClick
nodeIndexView.handleClick = function (click) {
  this.clickVector.x = (click.x / this.element.clientWidth) * 2 - 1
  this.clickVector.y = -(click.y / this.element.clientHeight) * 2 + 1
  this.clickVector.unproject(this.camera)
  this.clickVector.sub(this.camera.position)
  this.clickVector.normalize()

  this.raycaster.set(this.camera.position, this.clickVector)
  var contact = this.raycaster.intersectObjects(this.scene.children, true)
  if (contact.length) {
    var target = contact.slice(-1)[0].object
    var id = target.userData.id
    if (id && this.subviews[id] && this.subviews[id].model) {
      var data = this.subviews[id].model.data
      if (infoOverlay) {
        infoId.textContent = id
        infoUsername.textContent = (data.data && data.data.username) || '–'
        infoTransport.textContent = data.transport || '–'
        infoUpstream.textContent = data.upstream ? data.upstream.slice(-5) : (data.root ? 'ROOT' : '–')
        infoLevel.textContent = (data.health && data.health.level) || '0'
        infoScore.textContent = (data.health && data.health.score) || '–'
        infoDownstream.textContent = (data.health && data.health.downstreamCount) || '0'
        if (infoRtt) infoRtt.textContent = (data.health && data.health.rtt != null) ? data.health.rtt + 'ms' : '–'
        if (infoDropRate) infoDropRate.textContent = (data.health && data.health.dropRate != null) ? (data.health.dropRate * 100).toFixed(1) + '%' : '–'

        infoOverlay.classList.add('active')
      }
    }
  }
}
