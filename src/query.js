var _ = require('./utils.js');
var eventMethods = require('./events.js');


// Lazy filter over a collection or database collection
// The filter remains active and will emit change events when its results set changes
var Query = function(modelOrCollection, query, options) {
  query = query || {};
  options = options || {};

  var allCache;
  var firstCache;

  var getItems = function(onlyOne, cb) {
    if(modelOrCollection.klass == 'Model') {
      modelOrCollection.dataInterface.all({query: query}, function(err, items) {
        inst.length = items.length;
        allCache = items;
        firstCache = items[0];
        cb && cb(filter(items), onlyOne);
      });
    } else {
      cb(filter(modelOrCollection.values(), onlyOne));
    }
  };

  var filter = function(items, onlyOne) {
    return _.select(items, function(item) {
      return true;
    }, onlyOne ? 1 : options.limit);
  };

  var inst = _.merge(eventMethods(), {
    klass: 'Query',
    length: 0,

    resolve: function(cb) {
      var self = this;
      if(allCache) {
        cb && cb(allCache);
      } else {
        getItems(false, function(items) {
          cb && cb(items);
        });
      }
      return self;
    },

    first: function(cb) {
      var self = this;
      if(firstCache) {
        cb(firstCache);
      } else {
        getItems(true, function(items) {
          cb(items[0]);
        });
      }
      return self;
    },

    filter: function(moreQuery) {
      return Query(modelOrCollection, _.deepMerge(query, moreQuery), options);
    },

    limit: function(limit) {
      return Query(modelOrCollection, query, _.merge(options, {limit: limit}));
    },

    sortBy: function(fieldOrFunc) {
      return this;
    },

    clone: function() {
      return Query(modelOrCollection, query, options);
    },

    // Dynamically subscribe and unsubscribe when listeners are added and removed
    listenerAdded: function() {
      if(!subscribed) {
        subscribe();
      }
    },

    listenerRemoved: function() {
      var self = this;
      if(subscribed && self.listeners.length == 0) {
        // Defer unsubscribtion to allow immediately readding
        // handlers afer dropping to zero
        _.defer(function() {
          if(subscribed && self.listeners.length == 0) {
            unsubscribe();
            allCache = null;
            firstCache = null;
          }
        }, 1000);
      }
    }
  });

  var subscribed = false;

  var subscribe = function() {
    if(modelOrCollection.klass == 'Model') {
      if(_.onClient()) {
        console.log("subscribe " + modelOrCollection.name);
        modelOrCollection.app.pubSub.subscribe('create update delete', modelOrCollection.name, function(data) {
          console.log("Updating query due to pubsub");
          inst.getItems();
          inst.emit('change', 'length');
          inst.emit('change');
        });
        subscribed = true;
      }
    } else if(modelOrCollection.klass == 'Collection') {
      modelOrCollection.on('change:length', function() {
        allCache = null;
        firstCache = null;
        inst.emit('change', 'length');
        inst.emit('change');
      });
      subscribed = true;
    } else {
      throw 'Queries work with models and collections only';
    }
  };

  var unsubscribe = function() {
    console.log("unsubscribe");
    subscribed = false;
  };

  return inst;
};


module.exports = Query;
