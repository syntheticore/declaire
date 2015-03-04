var _ = require('underscore');
var Utils = require('./utils.js');
var Scope = require('./scope.js');


var Template = function(topNode, viewModels) {

  // Create a fresh, jQuery-wrapped DOM element
  var openDOMElement = function(tag, id, classes, attributes) {
    var html = '<' + tag;
    var addAttr = function(key, val) {
      if(!val) return;
      html += ' ' + key + '="' + val + '"';
    };
    if(id) addAttr('id', id);
    if(classes && classes.length) addAttr('class', classes.join(' '));
    if(attributes) {
      for(var attr in attributes) {
        var val = attributes[attr];
        addAttr(attr, val);
      }
    }
    html += '>';
    return html;
  };

  var closeDOMElement = function(tag) {
    return '</' + tag + '>';
  };

  // Replace all mustaches in text with the value of their paths
  var resolveMustaches = function(text, scope) {
    _.each(Utils.scan(text, /{(.*?)}/g).reverse(), function(m) {
      var i = m.index;
      var l = m[0].length;
      var expr = m[1];
      var val = evalExpr(scope, expr);
      // var val = evalInScope(expr, scope);
      text = text.substring(0, i) + val + text.substring(i+l);
    });
    return text;
  };

  // Does the given text contain mustache pairs?
  var hasMustaches = function(text) {
    return !!text.match(/{.*?}/);
  };

  // Is the given obj a string describing a data path?
  var isPath = function(obj) {
    return obj.match && !!obj.match(/^[A-z][A-z0-9]+(\.[A-z][A-z0-9]+)*$/);
  };

  // Evaluate a template expression,
  // which can either be a JS literal or a path
  var evalExpr = function(scope, expr) {
    var m;
    // Number
    if(!isNaN(expr)) {
      return parseFloat(expr);
    // String
    } else if(m = (expr.match && expr.match(/(["'])(.*)\1/))) {
      return m[2];
    // Array
    } else if(m = expr.match(/\[(.*)\]/)) {
      return _.map(m[1].split(','), function(item) {
        return evalExpr(scope, item);
      });
    } else {
      // Path
      return scope.resolvePath(expr).value;
    }
  };

  return {
    topNode: topNode,
    baseScope: Scope(),

    // Evaluate the given node in the context of the given scope
    // Returns a document fragment
    evaluate: function(node, scope) {
      var self = this;
      if(!node) node = self.topNode;
      if(!scope) scope = self.baseScope;
      var html = '';
      var recurse = function(scope) {
        _.each(node.children, function(child) {
          html += self.evaluate(child, scope);
        });
      };
      if(node.type == 'Instruction') {
        var evaluateIf = function(expressions, condition) {
          html += openDOMElement('span', null, ['placeholder']);
          var values = _.map(expressions, function(expr) {
            return evalExpr(scope, expr);
          });
          if(condition(values)) {
            recurse(scope);
          }
          html += closeDOMElement('span');
        };
        switch(node.keyword) {
          case 'if':
            evaluateIf([node.path], function(values) {
              return !!values[0];
            });
            break;
          case 'if-greater':
            evaluateIf([node.path1, node.path2], function(values) {
              return values[0] > values[1];
            });
            break;
          case 'if-equal':
            evaluateIf([node.path1, node.path2], function(values) {
              return values[0] == values[1];
            });
            break;
          case 'for':
            html += openDOMElement('span', null, ['placeholder']);
            var items = evalExpr(scope, node.itemsPath);
            for(var i in items) {
              var item = items[i];
              var itemData = {};
              itemData[node.itemPath] = item;
              if(node.children.length) {
                var newScope = scope.clone().addLayer(itemData);
                recurse(newScope);
              }
            }
            html += closeDOMElement('span');
            break;
          case 'view':
            var viewModel = viewModels[node.viewModel];
            var view = viewModel.create();
            var newScope = scope.clone().addLayer(view);
            recurse(newScope);
            break;
        }
      } else if(node.type == 'HTMLTag') {
        var attributes = {};
        var paths = [];
        // Resolve dynamic attributes
        for(var key in node.attributes) {
          var value = node.attributes[key];
          if(value.indexOf('{') != -1) {
            var expr = value.slice(1, -1);
            var res = scope.resolvePath(expr);
            attributes[key] = res.value;
            paths.push(expr);
          } else {
            attributes[key] = value;
          }
        }
        html += openDOMElement(node.tag, node.id, node.classes, attributes);
        // Nodes have either content or children
        if(node.content) {
          if(hasMustaches(node.content)) {
            html += resolveMustaches(node.content, scope);
          } else {
            html += node.content;
          }
        } else {
          recurse(scope);
        }
        html += closeDOMElement(node.tag);
      } else if(node.type == 'Text') {
        html += node.content;
      } else if(node.type == 'TOP') {
        recurse(scope);
      }
      return html;
    }
  };
};


module.exports = Template;
