var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var methodOverride = require('method-override');
var session = require('express-session');
var bodyParser = require('body-parser');
var multer = require('multer');
var compression = require('compression')
var errorHandler = require('errorhandler');
var fs = require('fs');
var stylus = require('stylus');
var mongo = require('mongodb');
var browserify = require('browserify');
var _ = require('underscore');

var Utils = require('./src/utils.js');
var Parser = require('./src/parser.js');
var Evaluator = require('./src/staticEvaluator.js');
var Model = require('./src/model.js');
var Collection = require('./src/collection.js');
var ViewModel = require('./src/viewModel.js');


var app = express();
// app.use(favicon(__dirname + '/public/favicon.png'));
app.use(logger('combined'));
app.use(methodOverride());
app.use(session({ resave: true,
                  saveUninitialized: true,
                  secret: 'uwotm8' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer());
app.use(stylus.middleware({
  src: __dirname + '/../../',
  dest: __dirname + '/../../public',
  compress: true,
  compile: function compile(str, path) {
    return stylus(str).set('filename', path).set('compress', true).use(require('nib')());
  }
}));
app.use(express.static(__dirname + '/../../public'));
app.use(compression());
app.use(require('jumanji'));

// Serve static pages with a less heavyweight layout
app.get('/', function(req, res) {
  res.redirect('/pages/index');
});

// Serve client-side implementation of Declaire
var bundle;
var prepareBundle = function(cb) {
  if(app.get('env') == 'production' && bundle) return cb(bundle);
  // Use executed application as main script on the client as well
  var appPath = process.argv[1];
  var code = fs.readFileSync(appPath).toString();
  // Exchange declaire include for client side implementation
  code = code.replace('require(\'declaire\')', 'require(\'./node_modules/declaire/src/clientAPI.js\')');
  var outputPath = __dirname + '/../../_declaire_client.js';
  // Write program back und bundle includes with browserify
  fs.writeFileSync(outputPath, code);
  var b = browserify();
  b.add(outputPath);
  b.bundle(function(err, buf) {
    if(err) throw err;
    fs.unlink(outputPath);
    bundle = buf;
    cb(bundle);
  });
};

app.get('/bundle.js', function(req, res) {
  prepareBundle(function(bundle) {
    // b.bundle().pipe(res);
    res.send(bundle);
  });
});

// Let New Relic measure uptime
app.get('/ping', function(req, res) { res.send('pong'); });

// Main application model
var mainModel = Model('_main', {
  _page: null
}).create();

// Load all templates recursively from layout
// and supply evaluator with main model
var layout = __dirname + '/../../views/layout.tmpl';
var viewModels = {};
var topNode;
var evaluator;
var parseLayout = function() {
  Utils.improveExceptions(layout, function() {
    topNode = Parser.parseTemplate(fs.readFileSync(layout, 'utf8'));
    evaluator = Evaluator(topNode, viewModels);
  });
  evaluator.baseScope.addLayer(mainModel);
};
parseLayout();

// Stream chunks of rendered html to callback function
var render = function(cb) {
  if(app.get('env') == 'development') parseLayout();
  cb({
    data: evaluator.evaluate(),
    eof: true
  });
};

// Make parse tree available to client-side evaluator
app.get('/template.json', function(req, res) {
  res.send(JSON.stringify(topNode));
});

// Render layout for the requested page
app.get('/pages/:page', function(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.write('<!DOCTYPE html><html>');
  mainModel.set('_page', '/pages/' + req.params.page);
  render(function(chunk) {
    res.write(chunk.data);
    if(chunk.eof) {
      res.write('</html>');
      res.end();
    }
  });
});

// Server-sent event stream
var clients = [];
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

// Broadcast a message to all connected clients
var emit = function(eventName, data) {
  db.collection('pubsub').insert(data, function(err, items) {
    if(err) console.log(err);
  });
};

// Show stack traces in development
if(app.get('env') == 'development') {
  app.use(errorHandler({dumpExceptions: true, showStack: true}));
}

// Serve RESTful resource
var serveResource = function(name) {
  var baseUrl = '/api/' + name;
  console.log("Serving resource " + baseUrl);

  // Get all items
  app.get(baseUrl, function(req, res) {
    var from = parseInt(req.query.queryFrom) || 0;
    var limit = parseInt(req.query.queryLimit) || 0;
    delete req.query._;
    delete req.query.queryFrom;
    delete req.query.queryLimit;
    db.collection(name).find(req.query, {image:0, salt:0, hash:0}).skip(from).limit(limit).toArray(function(err, items) {
      if(err) {
        res.send(404, err);
      } else {
        res.json(items);
      }
    });
  });

  // Create item
  app.post(baseUrl, function(req, res) {
    var fields = _.defaults(req.body, {createdAt: new Date(), updatedAt: new Date()});
    db.collection(name).insert(fields, function(err, items) {
      emit('create', {url: baseUrl + '/' + items[0]._id, values: items[0]});
      res.json(items[0]);
    });
  });

  // Get one item
  app.get(baseUrl + '/:id', function(req, res) {
    db.collection(name).findOne({_id: new mongo.ObjectID(req.params.id)}, {image:0, salt:0, hash:0}, function(err, item) {
      if(err) {
        res.send(404, err);
      } else {
        res.json(item);
      }
    });
  });

  // Update item
  app.post(baseUrl + '/:id', function(req, res) {
    var data = req.body;
    delete data._id;
    delete data.createdAt;
    data.updatedAt = new Date();
    db.collection(name).update({_id: new mongo.ObjectID(req.params.id)}, {$set: data}, function(err) {
      if(err) {
        res.send(404, err);
      } else {
        emit('update', {url: baseUrl + '/' + req.params.id, values: data});
        res.json({updatedAt: data.updatedAt});
      }
    });
  });

  // Delete item
  app.delete(baseUrl + '/:id', function(req, res) {
    var data = req.body;
    delete data._id;
    db.collection(name).remove({_id: new mongo.ObjectID(req.params.id)}, function(err) {
      emit('delete', {url: baseUrl + '/' + req.params.id});
      res.end();
    });
  });
};

var models = {};

// Server-side implementation of Declaire API
var db;
module.exports = {
  // Declare a new model type
  Model: function(name, reference) {
    var m = Model(name, reference);
    models[name] = m;
    serveResource(name);
    return m;
  },

  Collection: Collection,

  // Declare a new view model
  ViewModel: function(name, reference) {
    var vm = ViewModel(reference);
    viewModels[name] = vm;
    return vm;
  },

  // Initialize express server with middleware,
  // connect to database, call application hooks and listen for requests
  start: function(options, cb) {
    console.log("Starting declaire app");
    options = _.defaults(options, {
      mongoUrl: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/declaire'
    });
    if(options.mongoDevUrl && app.get('env') == 'development') {
      options.mongoUrl = options.mongoDevUrl;
    }
    // Connect to database and listen after successful connect
    mongo.MongoClient.connect(options.mongoUrl, function(err, dbs) {
      if(err) throw err;
      db = dbs;
      console.log("Connected to " + options.mongoUrl);
      // Mongo PubSub
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
              _.each(clients, function(res) {
                res.write('event: ' + 'pubsub' + '\n');
                res.write('data: ' + JSON.stringify(doc) + '\n\n');
                res.flush();
              });
            }
          });
        });
      });
      // Listen and call back
      var connect = function() {
        var port = options.port || process.env.PORT || 3000;
        var server = app.listen(port, function () {
          console.log('Listening on port ' + port);
          cb && cb(app, db);
        });
      };
      // Database hook
      if(options.beforeConnect) {
        options.beforeConnect(db, function() {
          connect();
        });
      } else {
        connect();
      }
    });
  }
};
