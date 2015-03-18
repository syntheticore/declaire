var Utils = require('./utils.js');
var eventMethods = require('./events.js');

var LocalStore;
// Use a dummy local store on the server, that never caches values
if(typeof(localStorage) == 'undefined') {
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

var db;


var Instance = function() {
  return Utils.merge(eventMethods, {
    klass: 'Model',
    model: null,
    id: null,
    listeners: [],
    data: {
      local: {},
      remote: {}
    },
    collections: {},
    computedProperties: {},

    // The server URL of this model instance
    url: function() {
      return this.id && '/api/' + this.model.name + '/' + this.id;
    },

    // The server URL of this model's collection
    baseUrl: function() {
      return '/api/' + this.model.name;
    },

    // Return the current value at the given key
    get: function(key) {
      //XXX Should return a deep copy of defaults and remote data
      var value = this.collections[key] || this.data.local[key] || this.data.remote[key] || this.model.defaults[key];
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
      //XXX Catch attempt to set a computed property or collection
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
      return Utils.merge(this.data.remote, this.data.local); //XXX Should the defaults be merged in as well?
    },

    // Are local modifications present that need to be saved?
    isDirty: function() {
      return !!_.keys(this.data.local).length;
    },

    // Discard local modifications and revert to server state
    revert: function() {
      var locals = this.data.local;
      this.data.local = [];
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
        var url = self.id ? self.url() : self.baseUrl();
        $.post(url, {data: JSON.stringify(self.data.local)}, function(data) {
          if(!self.id) {
            self.data.remote = data;
            self.id = data._id;
            self.connect();
          } else {
            self.data.remote = Utils.merge(self.data.remote, data);
          }
          self.data.local = [];
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
        self.data.remote = data;
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
        self.data.remote = Utils.merge(self.data.remote, data);
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
      db && db.unsubscribe(self.url());
      this.connected = false;
      return this;
    },

    // Delete object from all local models and collections it's referenced from
    // Also delete from the database, if model was persisted
    // All references from remote models and collections will auto-dissolve on next read
    delete: function(cb) {
      var self = this;
      $.ajax({url: self.url(), type: 'DELETE'})
      .done(function() {})
      .fail(function() {
        //XXX Handle offline case
      })
      .always(function() {
        cb && cb();
      });
    }
  });
};


// Define a new data model under the given name
var Model = function(modelName, reference) {
  var ref = separateMethods(reference);
  var model = {
    name: modelName,
    defaults: ref.defaults,

    // Create a fresh model instance
    create: function() {
      var inst = Instance();
      inst.model = this;
      for(var key in ref.methods) {
        inst[key] = ref.methods[key];
      }
      for(var key in ref.collections) {
        var collection = ref.collections[key].clone();
        collection.on('change', function() {
          inst.set(key);
          if(modelName != '_view') {
            inst.save();
          }
        });
        inst.collections[key] = collection;
      }
      return inst;
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
    methods: {},
    collections: {}
  };
  for(var key in reference) {
    var val = reference[key];
    if(typeof(val) == 'function') {
      ret.methods[key] = val;
    } else if(val && val.klass == 'Collection') {
      ret.collections[key] = val;
    } else {
      ret.defaults[key] = val;
    }
  }
  return ret;
};


module.exports = Model;



// TODO:
// Local-/remote-id handling
// Object deletion
// EventSource / Mongo-PubSub
// Collections
// Model relations
// Access permissions
// Selectively update data structures using deep merge
