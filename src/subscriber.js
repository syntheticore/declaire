// Receive push updates from the server
var Subscriber = function() {
  var subscribers = {};

  // Listen for server-sent events
  var evtSource = new EventSource('/events');
  evtSource.addEventListener('pubsub', function(e) {
    var obj = JSON.parse(e.data);
    // Call all matching subscribers
    var key = obj.type + obj.collection + (obj.id || '');
    var handlers = subscribers[key];
    for(var i in handlers) {
      handler(obj.data);
    }
  }, false);

  return {
    // Subscribe to all messages of a whole collection
    // Or supply an ID for just a single item
    subscribe: function(type, collection, idOrCb, handler) {
      var id;
      if(!handler) {
        handler = idOrCb;
      } else {
        id = idOrCb;
      }
      var key;
      if(id) {
        key = type + collection + id;
      } else {
        key = type + collection;
      }
      if(!subscribers[key]) subscribers[key] = [];
      subscribers[key].push(handler);
      return handler;
    },

    unsubscribe: function(handler) {

    }
  };
};

module.exports = Subscriber;
