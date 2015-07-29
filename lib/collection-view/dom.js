module.exports = DOMCollectionView

var inherits = require('inherits')
var CollectionView = require('./')

inherits(DOMCollectionView, CollectionView)

function DOMCollectionView () {
  CollectionView.call(this)
}

DOMCollectionView.prototype.addSubview = function (subview) {
  CollectionView.prototype.addSubview.apply(this, arguments)
  this.insertSubview(subview)
}

DOMCollectionView.prototype.removeSubview = function (subview) {
  CollectionView.prototype.removeSubview.apply(this, arguments)
  this.collectionElement.removeChild(subview.element)
}

DOMCollectionView.prototype.insertSubview = function (subview, beforeSubview) {
  if (beforeSubview) {
    this.collectionElement.insertBefore(subview.element, beforeSubview.element)
  } else {
    this.collectionElement.appendChild(subview.element)
  }
}

DOMCollectionView.prototype.subviewAtIndex = function (i) {
  return this.collectionElement.childNodes[i]
}
