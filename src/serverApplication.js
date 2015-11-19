require('http').globalAgent.maxSockets = Infinity
var fs = require('fs');
var path = require('path');

var mongo = require('mongodb');
var express = require('express');

var compression = require('compression')
var morgan = require('morgan');
var bodyParser = require('body-parser');
var multer = require('multer');
var lusca = require('lusca');
var favicon = require('serve-favicon');
var errorHandler = require('errorhandler');
var stylus = require('stylus');
var nib = require('nib');
var browserify = require('browserify');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

var _ = require('./utils.js');
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
  
  // Default options
  options = _.merge({
    mongoUrl: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/declaire',
    viewsFolder: './src/views/',
    npmPublic: ['/public']
  }, options);
  if(options.mongoDevUrl && expressApp.get('env') == 'development') {
    options.mongoUrl = options.mongoDevUrl;
  }
  
  // Logging
  expressApp.use(morgan('combined'));

  // Fix Safari caching bug
  expressApp.use(require('jumanji'));

  // Gzip compression
  expressApp.use(compression());

  // Mongo based sessions
  if(!process.env.SESSION_SECRET) console.warn("Warning: No SESSION_SECRET environment variable set!")
  expressApp.use(session({
    secret: process.env.SESSION_SECRET || 'devSecret',
    store: new MongoStore({url: options.mongoUrl}),
    saveUninitialized: true,
    resave: true
  }));
  
  // Prevent common vulnerabilities and attacks
  expressApp.use(lusca({
    // Cross site request forgery
    csrf: true,
    // Allow only images from other domains
    csp: {
      policy: {
        // 'default-src': "'self'",
        'img-src': '*'
      }
    },
    // Prevent clickjacking
    xframe: 'SAMEORIGIN',
    // Enforce HTTPS
    hsts: {maxAge: 31536000, includeSubDomains: true, preload: true},
    // Prevent cross site scripting
    xssProtection: true
  }));
  
  // Parse form data
  expressApp.use(bodyParser.json());
  expressApp.use(bodyParser.urlencoded({ extended: true }));
  
  // multipart/form-data
  expressApp.use(multer());
  
  // Compile Stylus stylesheets
  expressApp.use(stylus.middleware({
    src: './',
    dest: './public',
    compress: true,
    compile: function compile(str, path) {
      return stylus(str)
        .set('filename', path)
        .set('compress', true)
        .use(require('nib')())
        .import('nib');
    }
  }));
  
  // Serve public files
  var oneDay = 86400000;
  expressApp.use(express.static('./public', {maxAge: oneDay}));
  _.each(options.npmPublic, function(folder) {
    expressApp.use('/' + _.last(folder.split('/')), express.static('./node_modules/' + folder, {maxAge: oneDay}));
  });
  
  // Serve favicon
  try { expressApp.use(favicon('./public/favicon.png')) } catch(e) {
    console.error("Warning: Your application provides no icon!")
  }
  
  //XXX Remove this
  expressApp.get('/', function(req, res) {
    res.redirect('/pages/index');
  });

  // Package and minify JavaScript
  // Exchanges require calls to this very module with the client side implementation
  var bundle;
  var prepareBundle = function(cb) {
    if(bundle) return cb(bundle);
    process.stdout.write("Preparing Bundle...");
    // Use executed application as main script on the client as well
    var appPath = process.argv[1];
    var b = new browserify({debug: true});
    b.add(appPath);
    b.ignore('newrelic');
    b.ignore('express');
    b.ignore('connect');
    b.ignore('request');
    b.ignore('canvas');
    b.ignore('socket.io');
    // Exchange require calls
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
      bundle = buf;
      cb(bundle);
    });
  };

  expressApp.get('/bundle.js', function(req, res) {
    res.setHeader('Content-Type', 'application/javascript');
    prepareBundle(function(bundle) {
      res.send(bundle);
    });
  });

  // Let New Relic measure uptime
  expressApp.get('/ping', function(req, res) { res.send('pong'); });

  // Inject bootstrapping script and bundle reference into head tag
  var injectScripts = function(layout) {
    var bootstrap = fs.readFileSync('./node_modules/declaire/src/bootstrap.js', 'utf8');
    _.each(layout.children, function(node) {
      if(node.tag == 'head') {
        // Inject bootstrapping script
        var scriptTag = {
          type: 'HTMLTag',
          tag: 'script',
          children: [{
            type: 'Text',
            content: bootstrap
          }]
        };
        // node.children.push(scriptTag);
        // Inject bundle
        node.children.push({
          type: 'HTMLTag',
          tag: 'script',
          attributes: {
            src: {type: 'static', value: '/bundle.js'},
            async: {type: 'static', value: 'async'}
          },
          children: []
        });
        return false;
      }
    });
  };

  // Load and parse all templates in the views folder
  var parseTrees;
  var parseTemplates = function() {
    parseTrees = {};
    _.each(fs.readdirSync(options.viewsFolder), function(file) {
      if(path.extname(file) == '.dcl'){
        console.log("Parsing " + file);
        var fn = path.normalize(options.viewsFolder + file);
        try {
          var node = Parser.parseTemplate(fs.readFileSync(fn, 'utf8'));
          parseTrees[file] = node;
        } catch(e) {
          console.error( "Parse error: " + e.message + "\n  at " + fn + ":" + e.lineNum);
          throw e;
        }
      }
    });
    var layout = parseTrees['layout.dcl'];
    if(!layout) {
      console.error("ERROR: The main layout at " + path.normalize(options.viewsFolder + '/layout.dcl') + " could not be found!");
      process.exit(1);
    }
    injectScripts(layout);
  };
  parseTemplates();

  // Make parse trees available to client-side evaluator
  expressApp.get('/templates.json', function(req, res) {
    res.send(JSON.stringify(parseTrees));
  });

  // Save view model declarations for lookup in templates
  var viewModels = {};

  // Generic main model
  var MainModel = Model('_main', {_page: '/'});

  // Build an evaluator for the given URL
  var buildEvaluator = function(url) {
    // Create main model instance
    var mainModel = MainModel.create({_page: url});
    mainModel.set('_page', url);
    app.mainModel = mainModel;
    // Build evaluator for main layout
    var topNode = parseTrees['layout.dcl'];
    var evaluator = Evaluator(topNode, viewModels, parseTrees, StreamInterface());
    evaluator.baseScope.addLayer(mainModel);
    return evaluator;
  };

  // Render layout for the requested page
  expressApp.get('/pages/*', function(req, res) {
    res.setHeader('Content-Type', 'text/html');
    if(expressApp.get('env') == 'development') parseTemplates();
    var evaluator = buildEvaluator(req.url);
    // Stream chunks of rendered html
    evaluator.render().render(function(chunk) {
      // console.log(chunk);
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

  var app = {
    // Export main model
    mainModel: MainModel.create(),
    
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
    ViewModel: function(name, reference, constructor, postCb) {
      return this.use(ViewModel(name, reference, constructor, postCb));
    },

    // Proxy query constructor
    Query: function(modelOrCollection, query, options) {
      return this.use(Query(modelOrCollection, query, options));
    },

    // Connect to backend services, prepare bundle, call back
    init: function(cb) {
      var self = this;
      // Connect to database
      process.stdout.write("Connecting to database...");
      mongo.MongoClient.connect(options.mongoUrl, function(err, dbs) {
        if(err) throw err;
        console.log("done");
        self.db = dbs;
        // Mongo PubSub
        process.stdout.write("Preparing PubSub...");
        self.pubSub = require('./serverPublisher.js')(expressApp, self.db).init(function() {
          console.log("done");
          // start must be called by application code to listen for requests
          var start = function(cb) {
            var port = options.port || process.env.PORT || 3000;
            var server = expressApp.listen(port, function () {
              console.log("Listening on port " + port);
              cb && cb(server);
            });
          };
          // Make sure we have a cached bundle ready before listening for requests
          prepareBundle(function() {
            console.log("done");
            cb(start, expressApp, self.db)
          });
        });
      });
    }
  };
  return app;
};


module.exports = ServerApplication;
