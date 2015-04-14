var $ = require('jquery');
var Utils = require('./utils.js');
var Model = require('./model.js');
var ViewModel = require('./viewModel.js');
var Query = require('./query.js');
var DataInterface = require('./clientDataInterface.js');
var Evaluator = require('./evaluator.js');
var DOMInterface = require('./clientDOMInterface.js');
var Router = require('./clientRouter.js');

var localStore = require('./clientStore.js')();


var ClientApplication = function() {
   // Save view model declarations for lookup in templates
  var viewModels = {};

  // Create main model singleton instance
  var mainModel = Model('_main', {
    _page: null
  }).create();

  // Load pre-parsed template and
  // install evaluator on the document body
  var install = function(cb) {
    $.getJSON('/templates.json', function(templates) {
      var topNode = templates['layout.tmpl'];
      var body = topNode.children[1];
      var evaluator = Evaluator(body, viewModels, templates, DOMInterface());
      evaluator.baseScope.addLayer(mainModel);
      var frag = evaluator.render(function() {
        $('body').replaceWith(frag);
        cb();
      });
    });
  };

  // Process all database operations that happened while offline
  var flushPendingOperations = function() {
    var ops = localStore.pendingOperations();
    Utils.each(ops.save, function(data, key) {
      //XXX Load and update model
    });
    Utils.each(ops.delete, function(data, key) {
      //XXX Load and delete model
    });
  };
  flushPendingOperations();

  // Process pending database operations whenever
  // connectivity gets established anew
  mainModel.on('change:_online', function(online) {
    if(online) {
      flushPendingOperations();
    }
  });

  return {
    // Allow subscribing to database updates
    pubSub: require('./clientSubscriber.js')(),

    // Register models and view models for use with this application
    use: function(model) {
      model.app = this;
      if(model.klass == 'ViewModel') {
        viewModels[model.name] = model;
      } else if(model.klass == 'Model') {
        model.dataInterface = DataInterface(model.name);
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

    // Provide starter function which starts router
    init: function(cb) {
      // No init phase on client -> execute callback directly
      cb(function(cbb) {
        var installed = false;
        var router = Router();
        // Start routing
        router.on('/pages/:page', function(page) {
          mainModel.set('_page', page);
          // Install evaluator
          if(!installed) {
            installed = true;
            install(function() {
              // Make links use history api instead of default action
              router.hijackLocalLinks();
              cbb && cbb();
            });
          }
        });
      });
    }
  };
};


module.exports = ClientApplication;
