var Utils = require('./utils.js');
var Scope = require('./scope.js');


var Evaluator = function(topNode, viewModels, parseTrees, interface) {

  // Replace all mustaches in text with the value of their paths
  var resolveMustaches = function(text, scope) {
    var paths = [];
    Utils.each(Utils.scan(text, /{(.*?)}/g).reverse(), function(m) {
      var i = m.index;
      var l = m[0].length;
      var expr = m[1];
      var val = evalExpr(scope, expr);
      // var val = evalInScope(expr, scope);
      text = text.substring(0, i) + val + text.substring(i+l);
      if(isPath(expr)) paths.push(expr);
    });
    return {text: text, paths: paths};
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
    // Boolean
    if(expr == 'true') {
      return true;
    } else if(expr == 'false') {
      return false;
    // Null
    } else if(expr == 'null') {
      return null;
    // Number
    } else if(!isNaN(expr)) {
      return parseFloat(expr);
    // String
    } else if(m = (expr.match && expr.match(/(["'])(.*)\1/))) {
      return m[2];
    // Array
    } else if(m = expr.match(/\[(.*)\]/)) {
      return Utils.map(m[1].split(','), function(item) {
        return evalExpr(scope, item);
      });
    } else {
      // Path
      return scope.resolvePath(expr).value;
    }
  };

  var renderCb;
  var pending = 0;

  var unfinish = function(frag) {
    frag.unfinish && frag.unfinish();
    pending++;
  };

  var finish = function(frag) {
    frag.finish && frag.finish();
    pending--;
    if(!pending) {
      renderCb && renderCb();
      renderCb = null;
    }
  };

  return {
    baseScope: Scope(),

    // Render the complete template
    // Returns a document fragment on the client and a virtual DOM on the server
    // The optional callback is called when all views have been fully resolved
    render: function(cb) {
      renderCb = cb;
      var frag = this.evaluate(topNode, this.baseScope);
      if(!pending) {
        Utils.defer(function() {
          renderCb && renderCb();
          renderCb = null;
        });
      }
      return frag;
    },

    // Evaluate the given node in the context of the given scope
    // Returns a document fragment
    evaluate: function(node, scope) {
      var self = this;
      var frag = node.keyword == 'view' ? interface.createDOMElement('span', null, ['placeholder-view']) : interface.createFragment();
      var recurse = function(frag, scope) {
        Utils.each(node.children, function(child) {
          frag.append(self.evaluate(child, scope));
        });
      };
      if(node.type == 'Statement') {
        var evaluateIf = function(expressions, condition) {
          var elem = interface.createDOMElement('span', null, ['placeholder-if']);
          frag.append(elem);
          var values = Utils.map(expressions, function(expr) {
            return evalExpr(scope, expr);
          });
          node.paths = expressions;
          if(condition(values)) {
            recurse(elem, scope);
          }
          elem.node = node;
          elem.scope = scope;
          self.register(elem);
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
          case 'if-not-equal':
            evaluateIf([node.path1, node.path2], function(values) {
              return values[0] != values[1];
            });
            break;
          case 'for':
            var elem = interface.createDOMElement('span', null, ['placeholder-for']);
            frag.append(elem);
            node.paths = [node.itemsPath];
            elem.node = node;
            elem.scope = scope;
            var loop = function(items) {
              Utils.each(items, function(item) {
                var itemData = {};
                itemData[node.itemPath] = item;
                if(node.children.length) {
                  var newScope = scope.clone().addLayer(itemData);
                  recurse(elem, newScope);
                }
              });
              self.register(elem);
            };
            var items = evalExpr(scope, node.itemsPath);
            if(items.klass == 'Query') {
              unfinish(frag);
              items.all(function(items) {
                loop(items);
                finish(frag);
              });
            } else if(items.klass == 'Collection') {
              loop(items.values());
            } else {
              loop(items);
            }
            break;
          case 'view':
            var viewModel = viewModels[node.viewModel];
            if(node.viewModel && !viewModel) console.error('View model not found: ' + node.viewModel);
            // Evaluate constructor arguments
            var args = Utils.map(node.arguments, function(arg) {
              return evalExpr(scope, arg);
            });
            if(viewModel) {
              unfinish(frag);
              // Instantiate view model
              viewModel.create(args, frag, function(view) {
                // Add view model instance to scope
                var newScope = scope.clone().addLayer(view);
                // view.el = frag;
                view.scope = newScope;
                recurse(frag, newScope);
                finish(frag);
              });
            } else {
              recurse(frag, scope.clone());
            }
            break;
          case 'import':
            var importedNode = parseTrees[node.templateName];
            var args = Utils.map(node.arguments, function(expr) {
              return evalExpr(scope, expr);
            });
            var contentFrag = interface.createFragment();
            Utils.each(node.children, function(child) {
              contentFrag.append(self.evaluate(child, scope));
            });
            args._content = contentFrag;
            var newScope = Scope().addLayer(args);
            frag.append(self.evaluate(importedNode, newScope));
            break;
          case 'content':
            frag.append(scope.get('_content'));
            break;
        }
      } else if(node.type == 'HTMLTag') {
        // Don't regenerate script tags as these
        // would be downloaded and reexecuted each time
        if(node.tag == 'script' && Utils.onClient()) return frag;
        var attributes = {};
        var paths = [];
        // Resolve dynamic attributes
        for(var key in node.attributes) {
          var value = node.attributes[key];
          if(value.indexOf('{') != -1) {
            var expr = value.slice(1, -1);
            attributes[key] = scope.resolvePath(expr).value;
            paths.push(expr);
          } else {
            attributes[key] = value;
          }
        }
        var elem = interface.createDOMElement(node.tag, node.id, node.classes, attributes);
        // Nodes have either content or children
        if(node.content) {
          if(hasMustaches(node.content)) {
            var resolved = resolveMustaches(node.content, scope);
            elem.text(resolved.text);
            paths = Utils.union(paths, resolved.paths);
          } else {
            elem.text(node.content);
          }
        } else {
          recurse(elem, scope);
        }
        // If node had either dynamic content or dynamic attributes -> register for updates
        if(paths.length) {
          node.paths = paths; //XXX Should it be elem.paths?
          elem.node = node;
          elem.scope = scope;
          self.register(elem);
        }
        // Register action handlers
        // if(_.keys(node.actions).length) {
          Utils.each(node.actions, function(method, action) {
            //XXX Remove handler when a parent gets updated
            elem.on(action, function(e) {
              e.preventDefault();
              //XXX Read text from inputs and supply as argument to method
              return scope.resolvePath(method, [e]).value;
            });
          });
        // }
        frag.append(elem);
      } else if(node.type == 'Text') {
        frag.text(node.content);
      } else if(node.type == 'TOP') {
        recurse(frag, scope);
      }
      return frag;
    },

    // Replace DOM from this node downward with an updated version
    updateElement: function(elem) {
      //XXX Unbind event handlers for all elements below this one first
      Utils.each(elem.handlers, function(h) {
        Utils.defer(function() {
          h.obj.off(h.handler);
        });
      });
      elem.replaceWith(this.evaluate(elem.node, elem.scope));
    },

    // Register the given element for updates,
    // should the data at one of its paths change
    register: function(elem) {
      var self = this;
      if(Utils.onServer()) return;
      elem.handlers = [];
      // console.log(elem); //XXX this gets called way too often
      Utils.each(elem.node.paths, function(path) {
        if(isPath(path)) {
          var reference = elem.scope.resolvePath(path).ref;
          if(reference.obj && reference.obj.once) {
            var handler = function() {
              self.updateElement(elem);
            };
            var realHandler = reference.obj.once('change:' + reference.key, handler);
            elem.handlers.push({handler: realHandler, obj: reference.obj});
          }
        }
      });
    }
  };
};


module.exports = Evaluator;
