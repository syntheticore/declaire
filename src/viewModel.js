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
      // DOM element this instance was rendered to
      inst.el = elem;
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
      // Resolve instance on level deep
      inst.resolve(function() {
        // Completely execute asynchronous or synchronous constructor before calling back
        var promise = constructor && constructor.apply(inst, args);
        _.promiseFrom(promise).then(function() {
          cb(inst);
          if(_.onClient()) {
            _.defer(function() {
              // self.app.onAttach(function() {
                // postCb.apply(inst);
                inst.emit('attach');
              // });
            });
          }
        });
      });
    }
  };
};

module.exports = ViewModel;
