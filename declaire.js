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
var ViewModel = require('./src/viewModel.js');

// Connect to the first mongo database available
var mongoURL = process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/declaire';

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
app.use(errorHandler());


// Serve static pages with a less heavyweight layout
app.get('/', function(req, res) {
  res.render('index');
});

// Serve client-side implementation of Declaire
fs.writeFileSync(__dirname + '/src/app.js', fs.readFileSync(__dirname + '/../../app.js'));
var b = browserify();
b.add(__dirname + '/src/app.js');
app.get('/bundle.js', function(req, res) {
  b.bundle().pipe(res);
});

// Let New Relic measure uptime
app.get('/ping', function(req, res) { res.send('pong'); });

var layout = __dirname + '/../../views/layout.tmpl';
var mainModel = Model('_main', {
  _page: null
}).create();

var viewModels = {};

var topNode;
var evaluator;
var parseLayout = function() {
  console.log("Parsing template");
  Utils.improveExceptions(layout, function() {
    topNode = Parser.parseTemplate(fs.readFileSync(layout, 'utf8'));
    evaluator = Evaluator(topNode, viewModels);
  });
  evaluator.baseScope.addLayer(mainModel);
};
parseLayout();

var render = function(cb) {
  if('development' == app.get('env')) parseLayout();
  cb({
    data: evaluator.evaluate(),
    eof: true
  });
};

app.get('/template.json', function(req, res) {
  res.send(JSON.stringify(topNode));
});

// Serve single page layout on all other routes
app.get('/pages/*', function(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.write('<!DOCTYPE html><html>');
  mainModel.set('_page', '/pages/todos');
  render(function(chunk) {
    res.write(chunk.data);
    if(chunk.eof) {
      res.write('</html>');
      res.end();
    }
  });
});

// Server-sent event stream
app.get('/events', function (req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  var timer = setInterval(function () {
    res.write('event: update\n');
    res.write('data: {"time": "' + (new Date()).toString() + '"}');
    res.write('\n\n');
    res.flush();
  }, 2000);
  res.on('close', function () {
    clearInterval(timer);
  });
});

if('development' == app.get('env')) {
  app.use(errorHandler());
}

var db;
module.exports = {
  Model: Model,

  ViewModel: function(name, reference) {
    var vm = ViewModel(reference);
    viewModels[name] = vm;
    return vm;
  },

  start: function(options, cb) {
    options = _.defaults(options, {

    });
    // Connect to database and listen after successful connect
    mongo.MongoClient.connect(mongoURL, function(err, dbs) {
      if(err) throw err;
      db = dbs;
      console.log("Connected to database");
      var connect = function() {
        var port = process.env.PORT || 3000;
        var server = app.listen(port, function () {
          console.log('Listening on port ' + port);
          cb && cb(app, db);
        });
      };
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
