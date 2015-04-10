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

var Utils = require('./utils.js');
var Parser = require('./parser.js');
var Evaluator = require('./evaluator.js');
var StreamInterface = require('./streamInterface.js');
var Model = require('./model.js');
var ViewModel = require('./viewModel.js');
var Collection = require('./collection.js');
var Query = require('./query.js');
var DataInterface = require('./serverDataInterface.js');


var app = express();
// app.use(favicon(__dirname + '/../public/favicon.png'));
app.use(logger('combined'));
app.use(methodOverride());
app.use(session({ resave: true,
                  saveUninitialized: true,
                  secret: process.env.SESSION_SECRET || 'session123' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer());
app.use(stylus.middleware({
  src: __dirname + '/../../../',
  dest: __dirname + '/../../../public',
  compress: true,
  compile: function compile(str, path) {
    return stylus(str).set('filename', path).set('compress', true).use(require('nib')());
  }
}));
app.use(express.static(__dirname + '/../../../public'));
app.use(compression());
app.use(require('jumanji'));

app.get('/', function(req, res) {
  res.redirect('/pages/index');
});

// Serve client-side implementation of Declaire
var bundle;
var prepareBundle = function(cb) {
  if(bundle) return cb(bundle);
  console.log("Preparing bundle...");
  // Use executed application as main script on the client as well
  var appPath = process.argv[1];
  var code = fs.readFileSync(appPath).toString();
  // Exchange declaire include for client side implementation
  code = code.replace('require(\'declaire\')', 'require(\'./node_modules/declaire/src/clientAPI.js\')');
  var outputPath = __dirname + '/../../../_declaire_client.js';
  // Write program back und bundle includes with browserify
  //XXX use b.transform() instead of changing file on disk
  fs.writeFileSync(outputPath, code);
  var b = new browserify({debug: true});
  b.add(outputPath);
  b.ignore('newrelic');
  b.ignore('express');
  b.ignore('connect');
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

var viewModels = {};
var viewsFolder = __dirname + '/../../../views/';

// Build an evaluator for the main layout
// and add the main model instance to its scope
var evaluator;
var setupEvaluator = function() {
  var topNode = parseTrees['layout.tmpl'];
  evaluator = Evaluator(topNode, viewModels, parseTrees, StreamInterface());
  evaluator.baseScope.addLayer(mainModel);
};

// Load and parse all templates in the views folder
var parseTrees;
var parseTemplates = function() {
  parseTrees = {};
  Utils.each(fs.readdirSync(viewsFolder), function(file) {
    if(path.extname(file) == '.tmpl'){
      console.log("Parsing " + file);
      var fn = viewsFolder + file;
      Utils.improveExceptions(fn, function() {
        var node = Parser.parseTemplate(fs.readFileSync(fn, 'utf8'));
        parseTrees[file] = node;
      });
    }
  });
  setupEvaluator();
};
parseTemplates();

// Make parse trees available to client-side evaluator
app.get('/templates.json', function(req, res) {
  res.send(JSON.stringify(parseTrees));
});

// Render layout for the requested page
app.get('/pages/:page', function(req, res) {
  res.setHeader('Content-Type', 'text/html');
  if(app.get('env') == 'development') parseTemplates();
  mainModel.set('_page', req.params.page);
  // Stream chunks of rendered html
  evaluator.render().render(function(chunk) {
    console.log(chunk);
    res.write(chunk.data);
    res.flush();
    if(chunk.eof) {
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
    publisher = require('./publisher.js')(app, db).init(function() {
      // Listen and call back
      var start = function(cb) {
        // Make sure we have a cached bundle ready before listening for requests
        prepareBundle(function() {
          var port = options.port || process.env.PORT || 3000;
          var server = app.listen(port, function () {
            console.log('Listening on port ' + port);
            cb && cb();
          });
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
        },

        Utils: Utils,
        RSVP: require('rsvp')
      };

      options.beforeConnect(app, db, function() {
        cb(api, start);
      });
    });
  });
};
