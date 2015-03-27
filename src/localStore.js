var Utils = require('./utils.js');


var LocalStore = function() {
  // Retrieve object data from local storage
  var get = function(key) {
    var item = JSON.parse(localStorage.getItem(key));
    return item;
  };

  // Save object data to local storage
  // Also leave a timestamp and purge if neccessary
  var set = function(key, value, pendingType) {
    var json = JSON.stringify(Utils.merge(value, {_lastRequested: new Date()}));
    localStorage.setItem(key, json);
    purge();
  };

  // Returns true if all values in query match the
  // corresponding values in obj
  //XXX Replicate MongoDB query syntax
  var matches = function(obj, query) {
    // Allow the internal attributes in queries as well
    var data = Utils.merge(Utils.merge(obj.remote, obj.local), 
                           {_lastRequested: obj._lastRequested,
                            _pending: obj._pending});
    return Utils.all(query, function(value, key) {
      return data[key] == value;
    });
  };

  // Return all objects in local storage that match the given query
  var query = function(query) {
    var out = {};
    Utils.each(localStorage, function(item, key) {
      var item = get(key);
      if(matches(item, query)) out[key] = item;
    });
    return out;
  };

  // When the number of items in local storage exceeds 'maxItems',
  // delete 'deletePercentage'% of the least recently used items
  var purge = function(maxItems, deletePercentage) {
    maxItems = maxItems || 100;
    deletePercentage = deletePercentage || 20;
    var keys = Object.keys(localStorage);
    if(keys.length > maxItems) {
      // Sort by descending popularity
      keys.sort(function(a, b) {
        return get(b)._lastRequested.localeCompare(get(a)._lastRequested);
      });
      // Shave the given percentage off the bottom
      var startIndex = Math.round(maxItems * (deletePercentage / 100));
      for (var i = keys.length - 1; i >= startIndex; i--) {
        var key = keys[i];
        delete localStorage[key];
      };
    }
  };

  return {
    // Returns the cleaned up object at the given key
    get: function(localId) {
      var item = get(localId);
      delete item._lastRequested;
      delete item._pending;
      return item;
    },
    
    // Persist object data to local storage und the given key
    // Returns a function to be called once the actual transaction with the database succeeds
    save: function(localId, data) {
      set(localId, Utils.merge(data, {_pending: 'save'}));
      return function() {
        set(localId, Utils.merge(data, {_pending: false}));
      };
    },

    // Delete data at key from local storage
    // Returns a function to be called once the actual transaction with the database succeeds
    delete: function(localId) {
      set(localId, {_pending: 'delete'});
      return function() {
        delete localStorage[localId];
      };
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
