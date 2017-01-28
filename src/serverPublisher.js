var _ = require('./utils.js');


// Publish data from any server instance to all connected clients
var Publisher = function(express, db) {
  var clients = [];

  // Write data to all connected clients
  var distribute = function(data) {
    _.each(clients, function(client) {
      client.write('event: ' + 'pubsub' + '\n');
      client.write('data: ' + JSON.stringify(data) + '\n\n');
      client.flush();
    });
  };

  // Create tailable cursor on db to get notified of added documents
  var openCursor = function(cb) {

    var loadCollection = function(cbb) {
      db.collection('pubsub', {strict: true}, function(err, pubsub) {
        if(err) {
          // Loading collection failed -> Create it
          db.createCollection('pubsub', {capped: true, size: 4096, max: 10}, function(err, pubsub) {
            pubsub.insert({type: 'init'}, function(err) {
              if(err) throw err;
              cbb(pubsub);
            });
          });
        } else {
          cbb(pubsub);
        }
      });
    };

    loadCollection(function(pubsub) {
      // This technique will create stream of old items when a client reconnects
      // Wait for these to rush through before feeding data to clients
      pubsub
      .find({}, {tailable: true, awaitdata: true, numberOfRetries: -1})
      // .sort({$natural: 1})
      .each(function(err, doc) {
        if(doc) {
          delete doc._id;
          // Write new data to connected clients
          distribute(doc);
        }
      });
      // Wait for old documents to rush through
      // before allowing clients to connect
      _.defer(cb, 500);
      // Send a heartbeat to connected clients
      setInterval(function() {
        distribute({type: 'heartbeat'})
      }, 1000 * 25);
    });
  };

  // Server-sent event stream
  var listen = function() {
    express.get('/events', function (req, res) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      // Save response stream for later
      clients.push(res);
      // Delete connection on disconnect
      res.on('close', function () {
        clients.splice(clients.indexOf(res), 1);
        console.log("Declaire: Client disconnected");
      });
      console.log("Declaire: Serving " + clients.length + " clients");
    });
  };

  return {
    init: function(cb) {
      openCursor(function() {
        listen();
        cb();
      });
      return this;
    },

    publish: function(data) {
      db.collection('pubsub').insert(data, function(err, items) {
        if(err) console.log(err);
      });
      return this;
    },

    // Implement subscribe as a noop to make this 
    // interchangeable with the subscriber in models
    subscribe: function() {}
  };
};

module.exports = Publisher;
