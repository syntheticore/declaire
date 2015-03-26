var Utils = require('./utils.js');
var Evaluator = require('./clientEvaluator.js');
var Model = require('./model.js');
var ViewModel = require('./viewModel.js');
var Collection = require('./collection.js');
var Query = require('./query.js');
var DataInterface = require('./clientDataInterface.js');


// Collect view model definitions
// for lookup during evaluation
var viewModels = {};

// Create main model singleton instance
var mainModel = ViewModel({
  _page: null
}).create();

// Load pre-parsed template and
// install evaluator on the document body
var install = function(cb) {
  $.getJSON('/template.json', function(topNode) {
    var body = topNode.children[1];
    var evaluator = Evaluator(body, viewModels);
    evaluator.baseScope.addLayer(mainModel);
    var frag = evaluator.evaluate();
    $('body').replaceWith(frag);
    cb();
  });
};

var subscriber = require('./subscriber.js')();

module.exports = function(options, cb) {

  var start = function(cbb) {
    install(function() {
      var Router = Backbone.Router.extend({
        routes: {
          'pages/:page': function(page) {
            mainModel.set('_page', window.location.pathname);
          }
        }
      });
      new Router();
      Backbone.history.start({pushState: true});
      cbb && cbb();
    });
  };

  var api = {
    // Declare a new model type
    Model: function(name, reference) {
      var interface = DataInterface(name);
      return Model(name, reference, interface, subscriber);
    },

    // Declare a new view model type
    ViewModel: function(name, reference) {
      var vm = ViewModel(reference);
      viewModels[name] = vm;
      return vm;
    },

    Collection: Collection,

    Query: function(modelOrCollection, query) {
      return Query(subscriber, modelOrCollection, query);
    }
  };

  cb(api, start);
};


// TODO:
// Router
// Template imports
// Server rendering/streaming
// Else clauses
// Remote execution
// Load js using async attribute
