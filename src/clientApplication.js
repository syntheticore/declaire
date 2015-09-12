var $ = require('jquery');
var _ = require('./utils.js');
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
    _page: document.location.pathname
  }).create();

  // Load pre-parsed template and
  // install evaluator on the document body
  var install = function(cb) {
    $.getJSON('/templates.json', function(templates) {
      var topNode = templates['layout.tmpl'];
      var body = topNode.children[1];
      var evaluator = Evaluator(body, viewModels, templates, DOMInterface());
      // Add main model to baseScope
      evaluator.baseScope.addLayer(mainModel);
      // Render and replace body after page load event
      var frag = evaluator.render(function() {
        $(document).ready(function() {
          document.body.parentNode.replaceChild(frag, document.body);
          cb();
        });
      });
    });
  };

  // Process all database operations that happened while offline
  var flushPendingOperations = function() {
    var ops = localStore.pendingOperations();
    _.each(ops.save, function(data, key) {
      //XXX Load and update model
    });
    _.each(ops.delete, function(data, key) {
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

  // Stop collecting user events
  // and play back captured events
  var replayEvents = function() {
    return;
    var html = document.getElementsByTagName('html')[0];
    _.each(_declaireLogHandlers, function(handler, name) {
      html.removeEventListener(name, handler);
    });
    _.each(_declaireLog, function(e) {
      if(e.type == 'keypress') {
        var elem = $(e.target);
        elem.val(elem.val() + String.fromCharCode(e.which));
      } else if(e.type == 'click') {
        $(e.target).trigger('click');
      }
    });
  };

  return {
    // Allow subscribing to database updates
    pubSub: require('./clientSubscriber.js')(),

    // Export main model
    mainModel: mainModel,

    // Register models and view models for use with this application
    use: function(model) {
      model.app = this;
      if(model.klass == 'ViewModel') {
        viewModels[model.name] = model;
      } else if(model.klass == 'Model') {
        model.dataInterface = DataInterface(model);
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

    // Provide starter function which starts router
    init: function(cb) {
      // No init phase on client -> execute callback directly
      cb(function(cbb) {
        var router = Router();
        // Replace page with client generated version
        install(function() {
          // Make links use history api instead of default action
          router.hijackLocalLinks();
          console.log("Anchors have been hijacked");
          // Reproduce events captured during bootstrap phase
          replayEvents();
          // Start routing
          router.on('*', function() {
            console.log("router " + document.location.pathname);
            mainModel.set('_page', document.location.pathname);
          });
          cbb && cbb();
        });
      });
    }
  };
};


module.exports = ClientApplication;
