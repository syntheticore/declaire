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
var Minifyify = require('minifyify');

var Utils = require('./src/utils.js');
var Parser = require('./src/parser.js');
var Evaluator = require('./src/evaluator.js');
var StreamInterface = require('./src/streamInterface.js');
var Model = require('./src/model.js');
var ViewModel = require('./src/viewModel.js');
var Collection = require('./src/collection.js');
var Query = require('./src/query.js');
var DataInterface = require('./src/serverDataInterface.js');


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
  //XXX use b.transform() instead of changing file on disk
  fs.writeFileSync(outputPath, code);
  var b = new browserify({debug: true});
  b.add(outputPath);
  b.ignore('newrelic'); //XXX Add more common, server-only packages
  if(app.get('env') == 'production') b.plugin(Minifyify, {output: 'public/bundle.js.map', map: 'bundle.js.map'});
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
var topNode;
var evaluator;
var viewModels = {};
var parseLayout = function() {
  Utils.improveExceptions(layout, function() {
    topNode = Parser.parseTemplate(fs.readFileSync(layout, 'utf8'));
    evaluator = Evaluator(topNode, viewModels, StreamInterface());
  });
  evaluator.baseScope.addLayer(mainModel);
};
parseLayout();

// Make parse tree available to client-side evaluator
app.get('/template.json', function(req, res) {
  res.send(JSON.stringify(topNode));
});

// Render layout for the requested page
app.get('/pages/:page', function(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.write('<!DOCTYPE html><html>');
  if(app.get('env') == 'development') parseLayout();
  mainModel.set('_page', '/pages/' + req.params.page);
  // Stream chunks of rendered html
  evaluator.evaluate().render(function(chunk) {
    console.log(chunk);
    res.write(chunk.data);
    res.flush();
    if(chunk.eof) {
      res.write('</html>');
      res.end();
    }
  });
});

// Show stack traces in development
if(app.get('env') == 'development') {
  app.use(errorHandler({dumpExceptions: true, showStack: true}));
}

var db;
var publisher;

// Server-side implementation of Declaire API
module.exports = function(options, cb) {
  options = Utils.merge({
    mongoUrl: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/declaire',
    beforeConnect: function(app, db, cb) { cb() }
  }, options);
  if(options.mongoDevUrl && app.get('env') == 'development') {
    options.mongoUrl = options.mongoDevUrl;
  }
  // Initialize express server with middleware,
  // connect to database, call application hooks and listen for requests
  // Connect to database and listen after successful connect
  mongo.MongoClient.connect(options.mongoUrl, function(err, dbs) {
    if(err) throw err;
    db = dbs;
    console.log("Connected to " + options.mongoUrl);
    // Mongo PubSub
    publisher = require('./src/publisher.js')(app, db).init(function() {
      // Listen and call back
      var start = function(cb) {
        var port = options.port || process.env.PORT || 3000;
        var server = app.listen(port, function () {
          console.log('Listening on port ' + port);
          cb && cb();
        });
      };

      var api = {
        // Declare a new model type
        Model: function(name, reference) {
          var interface = DataInterface(name, app, db, publisher).serveResource();
          return Model(name, reference, interface);
        },

        // Declare a new view model
        ViewModel: function(name, reference, constructor) {
          var vm = ViewModel(reference, constructor);
          viewModels[name] = vm;
          return vm;
        },

        Collection: Collection,

        Query: function(modelOrCollection, query) {
          return Query(null, modelOrCollection, query);
        }
      };

      options.beforeConnect(app, db, function() {
        cb(api, start);
      });
    });
  });
};
