var Utils = require('./utils.js');
var Parser = require('./parser.js');
var Evaluator = require('./clientEvaluator.js');
var Model = require('./model.js');
var ViewModel = require('./viewModel.js');

var viewModels = {};

// Load template requested by name from the server
var loadTemplate = function(name, cb) {
  var fn = '/templates/' + name + '.tmpl';
  $.get(fn, function(tmpl) {
    Utils.improveExceptions(fn, function() {
      var node = Parser.parseTemplate(tmpl);
      var evaluator = Evaluator(node, viewModels);
      cb(evaluator);
    });
  });
};

// Load the named template, evaluate using given model (optional)
// and append the resulting fragment to the given DOM element
var render = function(tmplName, element, model) {
  loadTemplate(tmplName, function(evaluator) {
    if(model) {
      evaluator.baseScope.addLayer(model);
    }
    $(element).append(evaluator.evaluate());
  });
};

var mainModel = ViewModel('_main', {
  _page: null
}).create();

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
