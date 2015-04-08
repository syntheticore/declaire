var Utils = require('./utils.js');


module.exports = {
  // Register a handler to be called every time an event happens
  //XXX Support registering multiple events at once
  on: function(action, cb) {
    var res = action.split(':'); ///XXX not needed -> use event:key directly as event name
    this.listeners.push({
      action: res[0],
      key: res[1],
      cb: cb
    });
    return this;
  },

  // Remove a handler from all events it was registered for
  off: function(handler) {
    for (var i = this.listeners.length - 1; i >= 0; i--) {
      var l = this.listeners[i];
      if(l.cb === handler) {
        this.listeners.splice(i, 1);
      }
    }
    return this;
  },

  // Register a handler to be called as soon as an event happens
  once: function(action, cb) {
    var self = this;
    var handler = function() {
      cb();
      Utils.defer(function() {
        self.off(handler);
      });
    };
    self.on(action, handler);
    return handler;
  },

  // Call all handlers that listen to this event
  // Data is only used if a key is given
  emit: function(action, key, data) {
    var self = this;
    Utils.defer(function() {
      // console.log('emit ' + action + key);
      for(var i in self.listeners) {
        var l = self.listeners[i];
        if(l.action == action) {
          if(key) {
            if(l.key == key) {
              l.cb(data);
            }
          } else {
            if(!l.key) {
              l.cb();
            }
          }
        }
      }
    });
    return self;
  }
};
