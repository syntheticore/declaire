var Utils = require('./utils.js');
var Model = require('./model.js');

var ViewModel = function(reference) {
  var model = Model('_view', reference);
  return {
    create: function(cb) {
      var inst = model.create();
      inst.resolve(function() {
        cb(inst);  
      });
    }
  };
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
