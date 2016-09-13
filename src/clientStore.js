var _ = require('./utils.js');


var LocalStore = function(modelName) {
  // Iterate all items in local storage belonging to our model
  var all = function(cb) {
    for(var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if(key.indexOf(modelName) != -1) {
        var value = localStorage.getItem(key);
        key = key.split(':')[1];
        cb(value, key);
      }
    }
  };

  // Retrieve all keys belonging to our model
  var allKeys = function() {
    var keys = [];
    all(function(value, key) {
      keys.push(key);
    });
    return keys;
  };

  // Retrieve object data from local storage
  var get = function(key) {
    return JSON.parse(localStorage.getItem(modelName + ':' + key));
  };

  // Save object data to local storage
  // Also leave a timestamp and purge if neccessary
  var set = function(inst, options) {
    var data = inst.serialize();
    var meta = _.merge(options, {id: inst.id, localId: inst.localId, lastRequested: new Date()});
    var json = JSON.stringify({data: data, meta: meta});
    localStorage.setItem(modelName + ':' + (inst.id || inst.localId), json);
    purge();
  };

  var del = function(key) {
    localStorage.removeItem(modelName + ':' + key);
  }

  // Returns true if all values in query match the
  // corresponding values in obj
  //XXX Replicate MongoDB query syntax
  var matches = function(item, query) {
    // Allow the internal attributes in queries as well
    var data = _.merge(item.data, item.meta);
    return _.all(query, function(value, key) {
      if(value.$regex) {
        return data[key].indexOf(value.$regex) != -1;
      } else {
        return data[key] == value;
      }
    });
  };

  // Return all objects in local storage that match the given query
  var query = function(query, limit) {
    var out = {};
    all(function(item, key) {
      var item = get(key);
      if(matches(item, query) && item.meta._pending != 'delete') {
        out[key] = item;
      }
    });
    return out;
  };

  // When the number of items in local storage exceeds 'maxItems',
  // delete 'deletePercentage'% of the least recently used items
  var purge = function(maxItems, deletePercentage) {
    maxItems = maxItems || 100;
    deletePercentage = deletePercentage || 20;
    var keys = allKeys();
    if(keys.length > maxItems) {
      // Sort by descending popularity
      keys.sort(function(a, b) {
        return get(b).meta.lastRequested.localeCompare(get(a).meta.lastRequested);
      });
      // Shave the given percentage off the bottom
      var startIndex = Math.round(maxItems * (deletePercentage / 100));
      for(var i = keys.length - 1; i >= startIndex; i--) {
        var key = keys[i];
        del(key);
      };
    }
  };

  return {
    // Returns the cleaned up object at the given key
    get: function(localId) {
      var entry = get(localId);
      if(!entry) return null;
      return entry.meta._pending != 'delete' ? entry.data : null;
    },
    
    // Persist object data to local storage under the given key
    set: function(inst, options) {
      set(inst, options);
      return this;
    },

    // Delete data at key from local storage
    delete: function(localId) {
      del(localId);
      return this;
    },

    query: function(q, limit) {
      return _.values(query(q, limit));
    },

    // Retrieve all operations that didn't make it to the database yet
    pendingOperations: function() {
      return {
        save: query({_pending: 'save'}),
        delete: query({_pending: 'delete'})
      };
    }
  };
};

//XXX Objects create local references when parent objects get saved to local storage

module.exports = LocalStore;
