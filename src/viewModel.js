var Model = require('./model.js');

var ViewModel = function(reference) {
  return Model('view', reference);
};

module.exports = ViewModel;


// TODO:
// Generate REST URLs for models
// Local-/remote-id handling
// Object deletion
// EventSource / Mongo-PubSub
// Collections
// Model relations
// Access permissions
// Selectively update data structures using deep merge
