module.exports = function (storage) {
  if (!db) {
    db = storage
    ref = db.push()
    ref.set(Firebase.ServerValue.TIMESTAMP, function () {
      ref.on('value', ontimestamp)
    })
  }

  return realnow
}

var db = null
var ref = null
var offset = 0

function ontimestamp (snapshot) {
  var timestamp = snapshot.val()
  if (timestamp) {
    offset = Date.now() - snapshot.val()
    ref.off('value', ontimestamp)
    ref.remove()
  }
}

function realnow () {
  return offset ? Date.now() - offset : Date.now()
}
