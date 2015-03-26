var Utils = require('./utils.js');
var eventMethods = require('./events.js');


var Query = function(subscriber, modelOrCollection, query) {
  query = query || {};

  var getItems = function(onlyOne, cb) {
    if(modelOrCollection.klass == 'Model') {
      modelOrCollection.dataInterface.all({query: query}, function(err, items) {
        if(onlyOne) {
          cb(items[0]);
        } else {
          cb(items);
        }
      });
    } else {
      cb(filter(modelOrCollection.values(), query, onlyOne));
    }
  };

  var filter = function(items, query, onlyOne) {
    return items;
  };

  var inst = Utils.merge(eventMethods, {
    klass: 'Query',
    listeners: [],

    all: function(cb) {
      getItems(false, cb);
    },

    first: function(cb) {
      getItems(true, cb);
    },

    each: function(cb) {
      var self = this;
      getItems(false, function(items) {
        for(var i in items) {
          cb(items[i]);
        }
      });
    },

    filter: function(moreQuery) {
      return Query(subscriber, modelOrCollection, Utils.deepMerge(query, moreQuery));
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
      inst.emit('change');
    });
  }

  return inst;
};


module.exports = Query;

