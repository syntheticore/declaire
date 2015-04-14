var Utils = require('./utils.js');


// Receive push updates from the server
var Subscriber = function() {
  var subscribers = {};

  // Listen for server-sent events
  var evtSource = new EventSource('/events');
  evtSource.addEventListener('pubsub', function(e) {
    var obj = JSON.parse(e.data);
    // Call all matching subscribers
    var colKey = obj.type + obj.collection;
    var itemKey = colKey + obj.id;
    Utils.each(subscribers[itemKey], function(handler) {
      handler(obj.data);
    });
    Utils.each(subscribers[colKey], function(handler) {
      handler(obj.data);
    });
  }, false);

  return {
    // Subscribe to all messages of a whole collection
    // Or supply an ID for just a single item
    subscribe: function(types, collection, idOrCb, handler) {
      var id;
      if(!handler) {
        handler = idOrCb;
      } else {
        id = idOrCb;
      }
      types = types.split(' ');
      Utils.each(types, function(type) {
        var key;
        if(id) {
          key = type + collection + id;
        } else {
          key = type + collection;
        }
        if(!subscribers[key]) subscribers[key] = [];
        subscribers[key].push(handler);
      });
      return handler;
    },

    unsubscribe: function(handler) {

    }
  };
};

module.exports = Subscriber;
