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

var Utils = require('./utils.js');
var Parser = require('./parser.js');
var Evaluator = require('./evaluator.js');
var StreamInterface = require('./serverStreamInterface.js');
var Model = require('./model.js');
var ViewModel = require('./viewModel.js');
var Collection = require('./collection.js');
var Query = require('./query.js');
var DataInterface = require('./serverDataInterface.js');
var REST = require('./REST.js');


var ServerApplication = function(options) {
  // Create express app
  var expressApp = express();
  // Register express middleware
  // app.use(favicon(__dirname + '/../public/favicon.png'));
  expressApp.use(logger('combined'));
  expressApp.use(methodOverride());
  expressApp.use(session({ resave: true,
                    saveUninitialized: true,
                    secret: process.env.SESSION_SECRET || 'session123' }));
  expressApp.use(bodyParser.json());
  expressApp.use(bodyParser.urlencoded({ extended: true }));
  expressApp.use(multer());
  expressApp.use(stylus.middleware({
    src: __dirname + '/../../../',
    dest: __dirname + '/../../../public',
    compress: true,
    compile: function compile(str, path) {
      return stylus(str).set('filename', path).set('compress', true).use(require('nib')());
    }
  }));
  expressApp.use(express.static(__dirname + '/../../../public'));
  expressApp.use(compression());
  expressApp.use(require('jumanji'));

  expressApp.get('/', function(req, res) {
    res.redirect('/pages/index');
  });

  // Default options
  options = Utils.merge({
    mongoUrl: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/declaire',
    viewsFolder: __dirname + '/../../../src/views/'
  }, options);
  if(options.mongoDevUrl && expressApp.get('env') == 'development') {
    options.mongoUrl = options.mongoDevUrl;
  }

  // Package and minify JavaScript
  // Exchanges requires of this module with the client side implementation
  var bundle;
  var prepareBundle = function(cb) {
    if(bundle) return cb(bundle);
    console.log("Preparing bundle...");
    // Use executed application as main script on the client as well
    var appPath = process.argv[1];
    var b = new browserify({debug: true});
    b.add(appPath);
    b.ignore('newrelic');
    b.ignore('express');
    b.ignore('connect');
    // Exchange requires
    b.transform(require('aliasify'), {
      aliases: {
        "declaire": "./node_modules/declaire/src/clientAPI.js"
      },
      verbose: false
    });
    if(expressApp.get('env') == 'production') {
      b.plugin(require('minifyify'), {output: 'public/bundle.js.map', map: 'bundle.js.map'});
    }
    b.bundle(function(err, buf) {
      if(err) throw err;
      // fs.unlink(outputPath);
      bundle = buf;
      cb(bundle);
    });
  };

  expressApp.get('/bundle.js', function(req, res) {
    prepareBundle(function(bundle) {
      // b.bundle().pipe(res);
      res.send(bundle);
    });
  });

  // Let New Relic measure uptime
  expressApp.get('/ping', function(req, res) { res.send('pong'); });

  // Create main model singleton instance
  var mainModel = Model('_main', {
    _page: null
  }).create();

  // Save view model declarations for lookup in templates
  var viewModels = {};

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
    Utils.each(fs.readdirSync(options.viewsFolder), function(file) {
      if(path.extname(file) == '.tmpl'){
        console.log("Parsing " + file);
        var fn = options.viewsFolder + file;
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
  expressApp.get('/templates.json', function(req, res) {
    res.send(JSON.stringify(parseTrees));
  });

  // Render layout for the requested page
  expressApp.get('/pages/:page', function(req, res) {
    res.setHeader('Content-Type', 'text/html');
    if(expressApp.get('env') == 'development') parseTemplates();
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
  if(expressApp.get('env') == 'development') {
    expressApp.use(errorHandler({dumpExceptions: true, showStack: true}));
  }

  return {
    // Register models and view models for use with this application
    use: function(model) {
      model.app = this;
      if(model.klass == 'ViewModel') {
        viewModels[model.name] = model;
      } else if(model.klass == 'Model') {
        var dataface = DataInterface(this, model.name);
        model.dataInterface = dataface;
        REST(model.name, expressApp, dataface).serveResource();
      }
      return model;
    },

    // Proxy model constructor
    Model: function(name, reference) {
      return this.use(Model(name, reference));
    },

    // Proxy view model constructor
    ViewModel: function(name, reference, constructor) {
      return this.use(ViewModel(name, reference, constructor));
    },

    // Proxy query constructor
    Query: function(modelOrCollection, query, options) {
      return this.use(Query(modelOrCollection, query, options));
    },

    // Connect to backend services, prepare bundle, call back
    init: function(cb) {
      var self = this;
      // Connect to database
      mongo.MongoClient.connect(options.mongoUrl, function(err, dbs) {
        if(err) throw err;
        self.db = dbs;
        console.log("Connected to " + options.mongoUrl);
        // Mongo PubSub
        self.pubSub = require('./serverPublisher.js')(expressApp, self.db).init(function() {
          console.log("PubSub ready");
          // start must be called by application code to listen for requests
          var start = function(cb) {
            var port = options.port || process.env.PORT || 3000;
            var server = expressApp.listen(port, function () {
              console.log('Listening on port ' + port);
              cb && cb();
            });
          };
          // Make sure we have a cached bundle ready before listening for requests
          prepareBundle(function() {
            console.log("Bundle ready");
            cb(start, expressApp, self.db)
          });
        });
      });
    }
  };
};


module.exports = ServerApplication;
