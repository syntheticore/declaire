var Utils = require('./utils.js');
var eventMethods = require('./events.js');


var Query = function(subscriber, modelOrCollection, query, options) {
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
    return Utils.select(items, function(item) {
      return true;
    }, onlyOne ? 1 : options.limit);
  };

  var inst = Utils.merge(eventMethods, {
    klass: 'Query',
    listeners: [],
    length: 0,

    all: function(cb) {
      getItems(false, function(items) {
        this.length = items.length;
        cb(items);
      });
    },

    first: function(cb) {
      getItems(true, function(items) {
        this.length = items.length;
        cb(items);
      });
    },

    filter: function(moreQuery) {
      return Query(subscriber, modelOrCollection, Utils.deepMerge(query, moreQuery), options);
    },

    limit: function(limit) {
      return Query(subscriber, modelOrCollection, query, Utils.merge(options, {limit: limit}));
    },

    clone: function() {
      return Query(subscriber, modelOrCollection, query);
    }
  });

  if(modelOrCollection.klass == 'Model') {
    subscriber && subscriber.subscribe('create update delete', modelOrCollection.name, function(data) {
      inst.emit('change');
    });
  } else {
    modelOrCollection.on('change:length', function() {
      inst.emit('change', 'length');
      inst.emit('change');
    });
  }

  return inst;
};


module.exports = Query;

