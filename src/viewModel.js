var Utils = require('./utils.js');
var Model = require('./model.js');


// A non-persistable, auto-instantiated model, that supplies
// template scopes with dynamic data
// The constructor function may return a promise if it needs
// to do aynchronous work to set up model instances
var ViewModel = function(name, reference, constructor) {
  var model = Model('_view', reference);
  return {
    klass: 'ViewModel',
    name: name,

    // Return a fully resolved and constructed view model instance
    create: function(args, elem, cb) {
      var inst = model.create();
      inst.el = elem;
      inst.resolve(function() {
        var promise = constructor && constructor.apply(inst, args);
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
