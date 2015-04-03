var Utils = require('./utils.js');
var Model = require('./model.js');


// A non-persistable, auto-instantiated model, that supplies
// template scopes with dynamic data
// The constructor function may return a promise if it needs
// to do aynchronous work to set up model instances
var ViewModel = function(reference, constructor) {
  var model = Model('_view', reference);
  return {
    // Return a fully resolved and constructed view model instance
    create: function(cb) {
      var inst = model.create();
      inst.resolve(function() {
        var promise = constructor && constructor.apply(inst);
        if(promise) {
          promise.then(function() {
            cb(inst);
          });
        } else {
          cb(inst);  
        }
      });
    }
  };
};

module.exports = ViewModel;
