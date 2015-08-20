var RSVP = require('rsvp');

var Query = require('./query.js');
var _ = require('./utils.js');
var eventMethods = require('./events.js');


// var localStore;
// // Use a dummy local store on the server, that never caches values
// if(_.onServer()) {
//   localStore = {
//     get: function(key) {
//       return undefined;
//     },
//     save: function(key, value) {},
//     delete: function(key, value) {}
//   };
// } else {
//   localStore = require('./clientStore.js')();
// }


var Instance = function() {
  return _.merge(eventMethods(), {
    klass: 'Instance',
    model: null,
    id: null,
    localId: _.uuid(),
    // listeners: [],
    data: {
      local: {},
      remote: {}
    },
    // collections: {},
    computedProperties: {},

    // The server URL of this model instance
    url: function() {
      return this.id && this.model.url() + '/' + this.id;
    },

    // Return the current value at the given key
    get: function(key) {
      //XXX Should return a deep copy of defaults and remote data
      // var value = this.collections[key] || this.data.local[key] || this.data.remote[key] || this.model.defaults[key];
      var value = this.data.local[key];
      if(value === undefined) {
        value = this.data.remote[key];
      }
      // Methods called through get() are treated as computed properties
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
    set: function(valuesOrKey, value) {
      var values;
      if(value === undefined) {
        values = valuesOrKey;
      } else {
        values = {};
        values[valuesOrKey] = value;
      }
      for(var key in values) {
        this.data.local[key] = values[key];
        //XXX Catch attempt to set a computed property or collection
        this.emit('change', key);
        // Emit change events for computed properties as well
        //XXX Don't emit multiple times if CP depends on several values
        for(var k in this.computedProperties) {
          if(_.contains(this.computedProperties[k], key)) {
            this.emit('change', k);
          }
        }
      }
      this.emit('change');
      return this;
    },

    // The current state of the object, including local modifications
    properties: function() {
      return _.merge(this.data.remote, this.data.local);
    },

    // Are local modifications present that need to be saved?
    isDirty: function() {
      return !!Object.keys(this.data.local).length;
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
    save: function(values, cb) {
      var self = this;
      if(values) {
        self.set(values);
      }
      // LocalStore.set(self.localId, self.data);
      // localStore.save(self.localId, self.data);
      if(self.isDirty() || !self.id) {
        // Persist local changes to server
        var url = self.id ? self.url() : self.model.url();
        if(self.id) {
          self.model.dataInterface.update(self.id, self.data.local, function(err, updatedValues) {
            self.data.remote = _.merge(self.data.remote, updatedValues);
            finish();
          });
        } else {
          // Create fresh instance on the server
          //XXX offline case
          self.model.dataInterface.create(self, function(err, data) {
            self.data.remote = data;
            // self.id = data._id;
            self.connect();
            finish();
          });
        }
        var finish = function() {
          self.data.local = {};
          cb && typeof(cb) == 'function' && cb();
          self.emit('save');
        };
      }
      return self;
    },

    // Update the base state of the object from the server,
    // but leave local modifications intact
    fetch: function(cb) {
      var self = this;
      self.model.dataInterface.one(self.id, function(err, data) {
        if(err) {
          cb(null);
        } else {
          //XXX Rebuild collections
          //XXX Trigger change events
          self.data.remote = data;
          // localStore.save(self.localId, self.data);
          cb(self);
          self.emit('fetch');
        }
      }, true);
      return self;
    },

    // Delete object from all local models and collections it's referenced from
    // Also delete from the database, if model was persisted
    //XXX All references from remote models and collections will auto-dissolve on next read
    delete: function(cb) {
      var self = this;
      self.disconnect();
      self.deleted = true;
      self.model.dataInterface.delete(self.id, function() {
        // Check if cb really is a callback -> Allows for directly invoking delete as an action handler
        cb && typeof(cb) == 'function' && cb();
        self.emit('delete');
        // Discard event handlers
        self.discardEventHandlers();
      });
    },

    // Returns a reference object, usable for storage in the db
    reference: function() {
      return {_ref: {id: this.id || this.localId, collection: this.model.name}};
    },

    // Serialize object into a representation suitable for
    // storage on the server by referencing other model instances by ID
    serialize: function() {
      return references(this.properties());
    },

    // Load all referenced model instances
    resolve: function(cb) {
      var self = this;
      var resolved = _.map(self.data.remote, function(item) {
        if(item && item._ref) {
          var model = models[item._ref.collection];
          return model.load(item._ref.id);
        } else {
          return RSVP.resolve(item);
        }
      });
      RSVP.hash(resolved).then(function(instances) {
        _.each(instances, function(inst, key) {
          self.data.remote[key] = inst;
        });
        cb();
      });
    },

    // Subscribe to push updates from the server
    connect: function() {
      var self = this;
      if(self.connected || !self.id) throw("Trying to connect twice");
      // Merge push data into remote data bucket and emit change events
      self.model.app.pubSub.subscribe('update', self.model.name, self.id, function(data) {
        console.log("Received push update");
        console.log(data.data);
        self.data.remote = _.merge(self.data.remote, data.data);
        for(var key in data.data) {
          self.emit('change', key);
        }
        self.emit('change');
        self.emit('fetch');
      });
      // Delete object unless the delete push originated from ourselves
      self.model.app.pubSub.subscribe('delete', self.model.name, self.id, function() {
        console.log("Received push delete");
        if(!self.deleted) self.delete();
      });
      self.connected = true;
      return self;
    },

    // Unsubscribe from updates
    disconnect: function() {
      this.model.app.pubSub.unsubscribe(this.model.name, this.id);
      this.connected = false;
      return this;
    }
  });
};

var references = function(values) {
  var out = {};
  for(var key in values) {
    var value = values[key];
    if(value && value.klass == 'Instance') {
      out[key] = value.reference();
    } else if(value && value.klass == 'Collection') {
      out[key] = value.serialize();
    } else {
      out[key] = value;
    }
  }
  return out;
};


var models = {}; //XXX This is per package and should be per app

// Define a new data model under the given name
var Model = function(dbCollection, reference) {
  var ref = separateMethods(reference);
  var model = {
    klass: 'Model',
    name: dbCollection,
    defaults: ref.defaults,

    // The server URL of this model's collection
    url: function() {
      return '/api/' + this.name;
    },

    all: function() {
      return Query(this);
    },

    // Create a fresh model instance
    create: function(values) {
      var inst = Instance();
      inst.model = this;
      // Mix in methods from reference object
      for(var key in ref.methods) {
        inst[key] = ref.methods[key];
      }
      // Copy default collections to instance
      for(var key in ref.collections) {
        var collection = ref.collections[key].clone();
        // Re-emit change events from collection, so that computed properties and views can update
        //XXX Templates should listen for the more fine-grained 'add' and 'remove' events
        // collection.on('change', function() {
        //   inst.set(key, inst.get(key));
        //   // if(dbCollection != '_view') {
        //   //   inst.save();
        //   // }
        // });
        // inst.collections[key] = collection;
        // inst.set(key, collection);
        inst.data.remote[key] = collection;
      }
      // Copy default queries to instance
      for(var key in ref.queries) {
        var query = ref.queries[key].clone();
        // Re-emit change events from query
        // query.on('change', function() {
        //   inst.set(key, inst.get(key));
        // });
        // inst.set(key, query);
        inst.data.remote[key] = query;
      }
      // Copy default values from model and arguments
      // inst.set(_.merge(this.defaults, values));
      _.each(_.merge(this.defaults, values), function(value, key) {
        inst.data.remote[key] = value;
      });
      return inst;
    },

    // Load the object with the given id
    // Local storage will be used immediately if available
    // Server data gets fetched afterwards
    load: function(id) {
      var self = this;
      return new RSVP.Promise(function(resolve, reject) {
        self.dataInterface.one(id, function(err, inst) {
          if(inst) {
            resolve(inst);
          } else {
            reject();
          }
        });
      });
      // return new RSVP.Promise(function(resolve, reject) {
      //   var obj = this.create();
      //   obj.id = id;
      //   var localData = localStore.get(id);
      //   // Return immediately with local data if possible
      //   if(localData) {
      //     console.log("local data");
      //     obj.data = localData;
      //     resolve(obj);
      //     // Fetch anyways to receive more recent data
      //     obj.fetch(function(success) {
      //       // Object has been deleted on server -> Terminate local instance as well
      //       if(!success) {
      //         console.log("retroactively deleting local model");
      //         obj.delete();
      //       }
      //     });
      //   } else {
      //     console.log("remote data");
      //     // Fetch data from remote server
      //     obj.fetch(function(obj) {
      //       resolve(obj);
      //     });
      //   }
      //   // Also subscribe to updates
      //   obj.connect();
      // });
    }
  };
  models[model.name] = model;
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
    collections: {},
    queries: {}
  };
  for(var key in reference) {
    var val = reference[key];
    if(typeof(val) == 'function') {
      ret.methods[key] = val;
    } else if(val && val.klass == 'Collection') {
      ret.collections[key] = val;
    } else if(val && val.klass == 'Query') {
      ret.queries[key] = val;
    } else {
      ret.defaults[key] = val;
    }
  }
  return ret;
};


module.exports = Model;
