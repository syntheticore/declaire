var _ = require('./utils.js');


module.exports = function() {
  return {
    listeners: [],

    // Register a handler to be called every time an event happens
    //XXX Support registering multiple events at once
    on: function(action, cb) {
      var res = action.split(':'); ///XXX not needed -> use event:key directly as event name
      var l = {
        action: res[0],
        key: res[1],
        cb: cb
      };
      this.listeners.push(l);
      this.listenerAdded();
      return cb;
    },

    // Remove a handler from all events it was registered for
    off: function(handler) {
      for (var i = this.listeners.length - 1; i >= 0; i--) {
        var l = this.listeners[i];
        if(l.cb === handler) {
          this.listeners.splice(i, 1);
        }
      }
      this.listenerRemoved();
      return this;
    },

    // Register a handler to be called as soon as an event happens
    once: function(action, cb) {
      var self = this;
      var handler = function() {
        self.off(handler);
        cb();
      };
      self.on(action, handler);
      return handler;
    },

    // Call all handlers that listen to this event
    emit: function(action, key) {
      var self = this;
      var listeners = _.clone(self.listeners);
      // _.defer(function() {
        for(var i in listeners) {
          var l = listeners[i];
          if(l.action == action) {
            if(key) {
              if(l.key == key) {
                l.cb();
              }
            } else {
              if(!l.key) {
                l.cb();
              }
            }
          }
        }
      // });
      return self;
    },

    discardEventHandlers: function() {
      this.listeners = [];
      return this;
    },

    // Allow for overriding hooks
    listenerAdded: function() {},
    listenerRemoved: function() {}
  };
};
