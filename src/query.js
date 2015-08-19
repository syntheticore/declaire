var _ = require('./utils.js');
var eventMethods = require('./events.js');


var Query = function(modelOrCollection, query, options) {
  query = query || {};
  options = options || {};

  var getItems = function(onlyOne, cb) {
    if(modelOrCollection.klass == 'Model') {
      modelOrCollection.dataInterface.all({query: query}, function(err, items) {
        cb(filter(items), onlyOne);
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

  var inst = _.merge(eventMethods, {
    klass: 'Query',
    // listeners: [],
    length: 0,
    allCache: null,
    firstCache: null,

    all: function(cb) {
      var self = this;
      if(self.allCache) {
        cb(self.allCache);
      } else {
        getItems(false, function(items) {
          self.length = items.length;
          self.allCache = items;
          self.firstCache = items[0];
          cb && cb(items);
          inst.emit('change', 'length');
          inst.emit('change');
        });
      }
      return self;
    },

    first: function(cb) {
      var self = this;
      if(self.firstCache) {
        cb(self.firstCache);
      } else {
        getItems(true, function(items) {
          self.length = items.length;
          self.firstCache = items[0];
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
    }
  });

  if(modelOrCollection.klass == 'Model') {
    // if(modelOrCollection.app.pubSub) {
    if(_.onClient()) {
      console.log("subscribing " + modelOrCollection.name);
      modelOrCollection.app.pubSub.subscribe('create update delete', modelOrCollection.name, function(data) {
        console.log("Updating query due to pubsub");
        // console.log(data);
        inst.allCache = null;
        inst.firstCache = null;
        inst.emit('change', 'length');
        inst.emit('change');
      });
    }
  } else if(modelOrCollection.klass == 'Collection') {
    modelOrCollection.on('change:length', function() {
      inst.allCache = null;
      inst.firstCache = null;
      inst.emit('change', 'length');
      inst.emit('change');
    });
  } else {
    throw 'Queries work with models and collections only';
  }

  return inst;
};


module.exports = Query;
