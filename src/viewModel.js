var _ = require('./utils.js');
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
      // Remove persistance related methods
      delete inst.save;
      delete inst.fetch;
      delete inst.delete;
      delete inst.reference;
      delete inst.serialize;
      delete inst.connect;
      delete inst.disconnect;
      // DOM element this instance was rendered to
      inst.element = elem;
      // Allow for automatic removal of event handlers
      inst.listenToHandlers = [];
      inst.listenTo = function(obj, eventName, cb) {
        obj.on(eventName, cb);
        inst.listenToHandlers.push({obj: obj, cb: cb});
      };
      inst.on('remove', function() {
        _.each(inst.listenToHandlers, function(handler) {
          handler.obj.off(handler.cb);
        });
      });
      // Resolve instance
      inst.resolve(function() {
        // Completely execute asynchronous or synchronous constructor before calling back
        var promise = constructor && constructor.apply(inst, args);
        _.promiseFrom(promise).then(function() {
          cb(inst);
          if(_.onClient()) {
            // Defer once to be executed after view element has been filled
            _.defer(function() {
              //XXX This is really hacky and fails for children views that load data over the network
              // Defer again to be executed after children have been filled
              _.defer(function() {
                inst.emit('attach');
              });
            });
          }
        });
      });
    }
  };
};

module.exports = ViewModel;
