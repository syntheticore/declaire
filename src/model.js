var Utils = require('./utils.js');

var LocalStore;
if(typeof(localStorage) == undefined) {
  LocalStore = {
    get: function(key) {
      return undefined;
    },
    set: function(key, value) {}
  };
  $ = {
    get: function(url, cb) {

    },

    post: function(url, data, cb) {

    }
  };
} else {
  LocalStore = {
    get: function(key) {
      return JSON.parse(localStorage.getItem(key));
    },

    set: function(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };
}


var Instance = function() {
  return {
    model: null,
    id: null,
    listeners: [],
    data: {
      local: {},
      remote: {}
    },
    computedProperties: {},

    // The server URL of this model instance
    url: function() {
      return this.id && window.location.origin + '/api/' + this.model.name + '/' + this.id;
    },

    // Return the current value at the given key
    get: function(key) {
      //XXX Should return a deep copy of defaults and remote data
      var value = this.data.local[key] || this.data.remote[key] || this.model.defaults[key];
      // Functions called through get() are treated as computed properties
      if(typeof(this[key]) == 'function') {
        if(!value) {
          var self = this;
          var comp = findDependencies(function() {
            return self[key]();
          });
          value = comp.value;
          this.computedProperties[key] = comp.keys;
        }
      } else {
        // Leave a trace in case we were called from a computed property
        propertiesUsed.push(key);
      }
      return value;
    },

    // Register a local change
    // Can be called without a value after changes to a deeper structure
    set: function(key, value) {
      if(value != undefined) {
        this.data.local[key] = value;
      }
      //XXX Catch attempt to set a computed property
      this.emit('change', key);
      // Emit change events for computed properties as well
      for(var k in this.computedProperties) {
        if(_.contains(this.computedProperties[k], key)) {
          this.emit('change', k);
        }
      }
      this.emit('change');
      return this;
    },

    // The current state of the object,
    // including local modifications
    properties: function() {
      return merge(this.data.remote, this.data.local); //XXX Should the defaults be merged in as well?
    },

    // Are local modifications present that need to be saved?
    isDirty: function() {
      return !!_.keys(this.data.local).length;
    },

    // Discard local modifications and revert to server state
    revert: function() {
      var locals = this.data.local;
      this.data.local = [];
      this.save(); //XXX should only save if object was already persisted
      for(var key in locals) {
        this.emit('change', key);
      }
      this.emit('change');
      this.emit('revert');
      return this;
    },

    // Persist object
    // Also save local modifications to the server if possible
    //XXX Allow passing an object of properties to set and save directly
    save: function(cb) {
      var self = this;
      self.localId = _.uniqueId(self.model.name);
      LocalStore.set(self.localId, self.data);
      if(self.isDirty() || !self.id) {
        $.post(self.url(), self.data.local, function(data) {
          self.data.remote = self.properties();
          if(!self.id) {
            self.id = data.id;
            self.connect();
          }
          cb && cb();
          self.emit('save');
        });
      }
      return self;
    },

    // Update the base state of the object from the server,
    // but leave local modifications intact
    fetch: function(cb) {
      var self = this;
      $.get(self.url(), function(data) {
        self.data.remote = JSON.parse(data);
        cb();
        self.emit('fetch');
      });
      return self;
    },

    // Subscribe to push updates from the server
    connect: function() {
      var self = this;
      if(self.connected || !self.id) return;
      db && db.subscribe(self.url(), function(data) {
        self.data.remote = merge(self.data.remote, data);
        for(var key in data) {
          self.emit('change', key);
        }
        self.emit('change');
      });
      self.connected = true;
      return self;
    },

    // Unsubscribe from updates
    disconnect: function() {
      db.unsubscribe(self.url());
      return this;
    },

    // Register a handler to be called every time an event happens
    on: function(action, cb) {
      var res = action.split(':');
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
    emit: function(action, key) {
      var self = this;
      Utils.defer(function() {
        // console.log('emit ' + action + key);
        for(var i in self.listeners) {
          var l = self.listeners[i];
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
      });
      return self;
    }
  }
};


// Define a new data model under the given name
var Model = function(modelName, reference) {
  var ref = separateMethods(reference);
  var model = {
    name: modelName,
    defaults: ref.defaults,
    // Create a fresh model instance
    create: function() {
      var obj = Instance();
      obj.model = this;
      for(var key in ref.methods) {
        obj[key] = ref.methods[key];
      }
      return obj;
    },
    // Load the object with the given id
    // Local storage will be used immediately if available
    // Server data gets fetched afterwards
    load: function(id, cb) {
      var obj = this.create();
      obj.id = id;
      var localData = LocalStore.get(id);
      if(localData) {
        obj.data = localData;
        cb();
        obj.fetch();
      } else {
        obj.fetch(cb);
      }
      // Also subscribe to updates
      obj.connect();
      return obj;
    }
  };
  return model;
};


// Return new object with the fields from both given objects
var merge = function(obj1, obj2) {
  var obj = {};
  for(var i in obj1) {
    obj[i] = obj1[i];
  }
  for(var i in obj2) {
    obj[i] = obj2[i];
  }
  return obj;
};

// Log all getters called while generating a computed property
var propertiesUsed = [];
var findDependencies = function(cb) {
  propertiesUsed = [];
  var ret = cb();
  return {
    value: ret,
    keys: propertiesUsed
  };
};

// Separate the methods from the other values
var separateMethods = function(reference) {
  var ret = {
    defaults: {},
    methods: {}
  };
  for(var key in reference) {
    var val = reference[key];
    if(typeof(val) == 'function') {
      ret.methods[key] = val;
    } else {
      ret.defaults[key] = val;
    }
  }
  return ret;
};


module.exports = Model;



// TODO:
// Generate REST URLs for models
// Local-/remote-id handling
// Object deletion
// EventSource / Mongo-PubSub
// Collections
// Model relations
// Access permissions
// Selectively update data structures using deep merge
