var Utils = require('./utils.js');
var Evaluator = require('./clientEvaluator.js');
var Model = require('./model.js');
var Collection = require('./collection.js');
var ViewModel = require('./viewModel.js');


// Collect view model definitions
// for lookup during evaluation
var viewModels = {};

var mainModel = ViewModel('_main', {
  _page: null
}).create();

// Load pre-parsed template and
// install evaluator on the document body
var install = function() {
  $.getJSON('/template.json', function(topNode) {
    var body = topNode.children[1];
    var evaluator = Evaluator(body, viewModels);
    evaluator.baseScope.addLayer(mainModel);
    var frag = evaluator.evaluate();
    $('body').replaceWith(frag);
  });
};

// Receive push updates from the server,
// containing new model data
var evtSource = new EventSource('/events');
evtSource.addEventListener('update', function(e) {
  var obj = JSON.parse(e.data);
  // console.log(obj.time);
}, false);

module.exports = {
  Model: Model,
  Collection: Collection,

  ViewModel: function(name, reference) {
    var vm = ViewModel(reference);
    viewModels[name] = vm;
    return vm;
  },

  start: function(options, cb) {
    install();
    var Router = Backbone.Router.extend({
      routes: {
        'pages/:page': function(page) {
          mainModel.set('_page', window.location.pathname);
        }
      }
    });
    new Router();
    Backbone.history.start({pushState: true});
  }
};


// TODO:
// Router
// Template imports
// Server rendering/streaming
// View references
// Else clauses
// Client-/Server-only code segments
// Remote execution
