var _ = require('./utils.js');


// Lazy filter over a collection or database collection
// The filter remains active and will emit change events when its results set changes
var Query = function(modelOrCollection, query, options) {
  query = query || {};
  options = options || {};

  var allCache;

  var getItems = function(onlyOne, cb) {
    if(modelOrCollection.klass == 'Model') {
      var localItems = modelOrCollection.dataInterface.all(_.merge(options, {query: query}), function(err, items) {
        // allCache = items;
        cb && cb(filter(items, onlyOne));
      });
      return filter(localItems, onlyOne);
    } else {
      cb && cb(filter(modelOrCollection.items, onlyOne));
    }
  };

  var filter = function(items, onlyOne) {
    return _.select(items, function(item) {
      return true;
    }, onlyOne ? 1 : options.limit);
  };

  var subscribed = false;

  var subscribe = function() {
    if(modelOrCollection.klass == 'Model') {
      if(_.onClient()) {
        console.log("subscribe " + modelOrCollection.name);
        modelOrCollection.app.pubSub.subscribe('create update delete', modelOrCollection.name, function(data) {
          console.log("Updating query due to pubsub");
          getItems(false, function() {
            inst.emit('change:' + 'size');
            inst.emit('change');
          });
        });
        subscribed = true;
      }
    } else if(modelOrCollection.klass == 'Collection') {
      modelOrCollection.on('change:size', function() {
        allCache = null;
        inst.emit('change:' + 'size');
        inst.emit('change');
      });
      subscribed = true;
    } else {
      console.error('Queries work with models and collections only');
    }
  };

  var unsubscribe = function() {
    console.log("unsubscribe");
    subscribed = false;
  };

  var inst = {
    klass: 'Query',
    // length: 0,
    query: query,

    // Return actual results for this query,
    // from cache or from the data interface
    resolve: function(cb) {
      var self = this;
      if(allCache) {
        cb(allCache);
      } else {
        var localResolve = false;
        var localItems = getItems(false, function(items) {
          if(!localResolve) cb(items);
        });
        if(localItems && localItems.length) {
          localResolve = true;
          cb(localItems);
        }
      }
      return self;
    },

    // Return only the first match
    first: function(cb) {
      var self = this;
      if(allCache && allCache[0]) {
        cb(allCache[0]);
      } else {
        getItems(true, function(items) {
          cb(items[0]);
        });
      }
      return self;
    },

    // Return another Query with the given filter applied
    filter: function(moreQuery) {
      return Query(modelOrCollection, _.deepMerge(query, moreQuery), options);
    },

    // Return another Query that has its limit set
    limit: function(limit) {
      return Query(modelOrCollection, query, _.merge(options, {limit: limit}));
    },

    // Return another query with a sort constraint set 
    sortBy: function(fieldOrFunc) {
      return this.clone();
    },

    // Call the given method on all result objects
    // Will resolve this collection
    invoke: function(method) {
      var args = Array.prototype.slice.call(arguments).splice(1);
      this.resolve(function(items) {
        _.invoke.apply(null, _.union([items, method], args));
      });
      return this;
    },

    clone: function() {
      return Query(modelOrCollection, query, options);
    },

    // Return a promise that resolves to the result set's length
    size: function() {
      var self = this;
      return _.promise(function(ok, fail) {
        self.resolve(function(items) {
          ok(items.length);
        });
      });
    }
  };

  _.eventHandling(inst);

  // Dynamically subscribe and unsubscribe when listeners are added and removed
  inst.on('listenerAdded', function() {
    if(!subscribed) {
      subscribe();
    }
  });

  inst.on('listenerRemoved', function() {
    if(subscribed && inst.listeners.length == 0) {
      // Defer unsubscribtion to allow immediately readding
      // handlers afer dropping to zero
      _.defer(function() {
        if(subscribed && inst.listeners.length == 0) {
          unsubscribe();
          allCache = null;
        }
      }, 1000);
    }
  });

  return inst;
};


module.exports = Query;
