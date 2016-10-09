var RSVP = require('rsvp');

var Query = require('./query.js');
var Collection = require('./collection.js');
var _ = require('./utils.js');


var Instance = function() {
  var inst = {
    klass: 'Instance',
    model: null,
    id: null,
    localId: _.uuid(),
    data: {
      local: {},
      remote: {},
      temporary: {}
    },
    // collections: {},
    computedProperties: {},

    // The server URL of this model instance
    url: function() {
      return this.id && this.model.url() + '/' + this.id;
    },

    // Return the current value at the given key
    get: function(key) {
      // Catch remaining arguments as parameters for computed properties
      var args = Array.prototype.slice.call(arguments).splice(1);
      //XXX Should return a deep copy of defaults and remote data
      // var value = this.collections[key] || this.data.local[key] || this.data.remote[key] || this.model.defaults[key];
      var value = this.data.local[key];
      if(value === undefined) {
        value = this.data.remote[key];
      }
      // Defaults may have changed in code since object was created
      if(value === undefined) {
        var def = this.model.defaults[key];
        value = (def && def.clone ? def.clone() : _.clone(def));
      }
      // Use temporary value as last resort
      if(value === undefined) {
        value = this.data.temporary[key];
      }
      // Methods called through get() are treated as computed properties
      if(typeof(this[key]) == 'function') {
        if(!value) {
          var self = this;
          var comp = findDependencies(function() {
            // Pass potential arguments to computed property
            return self[key].apply(self, args);
          });
          value = comp.value;
          // Remember dependencies
          this.computedProperties[key] = comp.keys;
        }
      } else {
        // Leave a trace in case we were called from a computed property
        propertiesUsed.push(key);
      }
      return value;
    },

    // Register a local change
    set: function(valuesOrKey, value, options) {
      options = options || {};
      // Allow for setting single values or whole hashes
      var values;
      if(value === undefined) {
        values = valuesOrKey;
      } else {
        values = {};
        values[valuesOrKey] = value;
      }
      for(var key in values) {
        // Save given value locally
        if(options.local) {
          this.data.temporary[key] = values[key];
        } else {
          this.data.local[key] = values[key];
        }
        //XXX Catch attempt to set a computed property or collection
        // Emit specific change event
        this.emit('change:' + key);
        // Emit change events for computed properties as well
        for(var k in this.computedProperties) {
          if(_.contains(this.computedProperties[k], key)) {
            this.emit('change:' + k);
          }
        }
      }
      // Emit generic change event
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
    // Will also discard temporary data
    revert: function() {
      // var locals = _.merge(this.data.temporary, this.data.local);
      var locals = this.data.local;
      this.data.local = {};
      // this.data.temporary = {};
      for(var key in locals) {
        this.emit('change:' + key);
      }
      this.emit('change');
      this.emit('revert');
      return this;
    },

    // Persist object
    // Also save local modifications to the server if possible
    save: function(values) {
      var self = this;
      // Detect event object to allow calling from actions
      if(values && values.target) {
        values = undefined;
      }
      // Allow setting values immediately before saving
      if(values) {
        self.set(values);
      }
      if(self.isDirty() || !self.id) {
        // Persist local changes to server
        var url = self.id ? self.url() : self.model.url();
        if(self.id) {
          self.model.dataInterface.update(self.id, self.data.local, function(err, updatedValues) {
            self.data.remote = _.merge(self.data.remote, updatedValues);
            finish();
          });
        } else {
          // Create fresh instance on the server
          self.model.dataInterface.create(self, function(err, data) {
            self.data.remote = data;
            // self.id = data._id;
            self.connect();
            finish();
          });
          // Emit create event
          self.model.emit('create', [self]);
        }
        var finish = function() {
          self.data.local = {};
          self.emit('save');
        };
      } else {
        // Emit save event anyway to be more predictable
        self.emit('save');
      }
      return self;
    },

    // Update the base state of the object from the server,
    // but leave local modifications intact
    fetch: function(cb) {
      var self = this;
      self.model.dataInterface.one(self.id, function(err, data) {
        if(err) {
          cb && cb(null);
        } else {
          //XXX Rebuild collections
          //XXX Trigger change events
          self.data.remote = data;
          // localStore.save(self.localId, self.data);
          cb && cb(self);
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
      return {_ref: {id: this.id, localId: this.localId, collection: this.model.name}};
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
      if(self.connected) throw("Trying to connect twice");
      if(!self.id) throw("Trying to connect unsaved model");
      // Merge push data into remote data bucket and emit change events
      self.model.app.pubSub.subscribe('update', self.model.name, self.id, function(data) {
        console.log("Received push update");
        console.log(data.data);
        self.data.remote = _.merge(self.data.remote, data.data);
        for(var key in data.data) {
          self.emit('change:' + key);
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
  };

  _.eventHandling(inst);

  return inst;
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
var Model = function(dbCollection, reference, constructor) {
  var ref = separateMethods(reference);
  var model = {
    klass: 'Model',
    name: dbCollection,
    defaults: _.merge(_.merge(ref.defaults, ref.collections), ref.queries),

    // The server URL of this model's collection
    url: function() {
      return '/api/' + this.name;
    },

    // Return a Query over all items of this model
    all: function() {
      return Query(this);
    },

    // Return a Query over all items of this model with a filter already set
    filter: function(query, options) {
      return Query(this, query, options);
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
        inst.data.remote[key] = collection;
      }
      // Copy default queries to instance
      for(var key in ref.queries) {
        var query = ref.queries[key].clone();
        inst.data.remote[key] = query;
      }
      // Copy default values from model
      _.each(ref.defaults, function(value, key) {
        inst.data.remote[key] = _.clone(value);
      });
      // Copy constructor arguments
      _.each(values, function(value, key) {
        inst.data.remote[key] = value;
      });
      // Call constructor function
      constructor && constructor.call(inst, values);
      return inst;
    },

    // Load the object with the given id
    // Local storage will be used immediately if available
    // Server data gets fetched afterwards
    load: function(id, cb) {
      var self = this;
      return _.promise(function(ok, fail) {
        self.dataInterface.one(id, function(err, inst) {
          if(inst) {
            cb && cb(inst);
            ok(inst);
          } else {
            cb && cb();
            fail('Could not load ' + self.name + '#' + id);
          }
        });
      });
    }
  };
  models[model.name] = model;
  _.eventHandling(model);
  return model;
};


// Log all getters called while generating
// a computed property in a global array
var propertiesUsed = [];
var findDependencies = function(cb) {
  propertiesUsed = [];
  var ret = cb();
  return {
    value: ret,
    keys: _.clone(propertiesUsed)
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
    } else if(val && Array.isArray(val)) {
      ret.collections[key] = Collection(val);
    } else {
      ret.defaults[key] = val;
    }
  }
  return ret;
};


module.exports = Model;
