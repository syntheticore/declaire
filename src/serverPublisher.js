// Publish data from any server instance to all connected clients
var Publisher = function(app, db) {
  var clients = [];

  // Create tailable cursor on db to get notified of added documents
  var openCursor = function(cb) {
    db.collection('pubsub').drop();
    db.createCollection('pubsub', {capped: true, size: 10000}, function(err, pubsub){
      if(err) throw err;
      pubsub.insert({type: 'init'}, function(err, items) {
        if(err) throw err;
        pubsub
        .find({}, {tailable: true, awaitdata: true, numberOfRetries: -1})
        .sort({$natural: 1})
        .each(function(err, doc) {
          if(doc) {
            // Write new data to connected clients
            for(var i in clients) {
              var res = clients[i];
              delete doc._id;
              res.write('event: ' + 'pubsub' + '\n');
              res.write('data: ' + JSON.stringify(doc) + '\n\n');
              res.flush();
            }
          }
        });
        cb();
      });
    });
  };

  // Server-sent event stream
  var listen = function() {
    app.get('/events', function (req, res) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      // Save response stream for later
      clients.push(res);
      // Delete connection on disconnect
      res.on('close', function () {
        clients.splice(clients.indexOf(res), 1);
        console.log("Client disconnected");
      });
      console.log("Serving " + clients.length + " clients");
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
