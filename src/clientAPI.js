var Utils = require('./utils.js');
var Evaluator = require('./evaluator.js');
var DOMInterface = require('./domInterface.js');
var Model = require('./model.js');
var ViewModel = require('./viewModel.js');
var Collection = require('./collection.js');
var Query = require('./query.js');
var DataInterface = require('./clientDataInterface.js');

var localStore = require('./localStore.js')();

// Collect view model definitions
// for lookup during evaluation
var viewModels = {};

// Create main model singleton instance
var mainModel = Model('_main', {
  _page: null
}).create();

// Load pre-parsed template and
// install evaluator on the document body
var install = function(cb) {
  $.getJSON('/template.json', function(topNode) {
    var body = topNode.children[1];
    var evaluator = Evaluator(body, viewModels, DOMInterface);
    evaluator.baseScope.addLayer(mainModel);
    var frag = evaluator.evaluate();
    $('body').replaceWith(frag);
    cb();
  });
};

// Allow subscribing to database updates
var subscriber = require('./subscriber.js')();

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


module.exports = function(options, cb) {

  var api = {
    // Declare a new model type
    Model: function(name, reference) {
      var interface = DataInterface(name);
      return Model(name, reference, interface, subscriber);
    },

    // Declare a new view model type
    ViewModel: function(name, reference, constructor) {
      var vm = ViewModel(reference, constructor);
      viewModels[name] = vm;
      return vm;
    },

    Collection: Collection,

    Query: function(modelOrCollection, query) {
      return Query(subscriber, modelOrCollection, query);
    }
  };

  // Return the API methods and a starter function to be
  // called as soon as all models have been defined
  cb(api, function(cbb) {
    var installed = false;
    var Router = Backbone.Router.extend({
      routes: {
        'pages/:page': function(page) {
          mainModel.set('_page', window.location.pathname);
          if(!installed) {
            install(function() {
              installed = true;
              cbb && cbb();
            });
          }
        }
      }
    });
    new Router();
    Backbone.history.start({pushState: true});
    cbb && cbb();
  });
};


// TODO:
// Router
// Template imports
// Else clauses
// Remote execution
// Load js using async attribute
