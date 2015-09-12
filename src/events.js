var _ = require('./utils.js');


module.exports = function() {
  return {
    listeners: [],

    // Register a handler to be called every time an event happens
    //XXX Support registering multiple events at once
    on: function(actions, cb) {
      var self = this;
      actions = actions.split(' ');
      _.each(actions, function(action) {
        var res = action.split(':');
        var l = {
          action: res[0],
          key: res[1],
          cb: cb
        };
        self.listeners.push(l);
        self.listenerAdded();
      });
      // return function() {
      //   self.off(cb);
      // };
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
    once: function(actions, cb) {
      var self = this;
      var handler = function() {
        self.off(handler);
        cb();
      };
      return self.on(actions, handler);
    },

    // Call all handlers that listen to this event
    emit: function(action, key, data) {
      var self = this;
      data = _.merge({
        action: action,
        object: self,
        property: key
      }, data);
      var listeners = _.clone(self.listeners);
      for(var i in listeners) {
        var l = listeners[i];
        if(l.action == action) {
          if(key) {
            if(l.key == key) {
              l.cb.call(self, data);
            }
          } else {
            if(!l.key) {
              l.cb.call(self, data);
            }
          }
        }
      }
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
