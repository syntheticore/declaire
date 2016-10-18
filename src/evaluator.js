var _ = require('./utils.js');
var Scope = require('./scope.js');


// Renders a parse tree from <topNode> downward and emits either
// a document fragment or a virtual DOM
var Evaluator = function(topNode, viewModels, parseTrees, interface, mainModel) {

  // Replace all mustaches in text with the value at their paths
  var resolveMustaches = function(text, scope, node, cb) {
    // Collect mustaches in reverse order
    var matches = _.scan(text, /{(.*?)}/g).reverse();
    // Resolve all - potentially asynchronous - expressions
    // and collect their paths along the way
    var paths = [];
    var promises = _.map(matches, function(m) {
      var i = m.index;
      var l = m[0].length;
      var expr = m[1];
      paths = paths.concat(detectCompoundPaths(expr));
      return evalCompoundExpr(scope, expr, node).then(function(value) {
        return {
          index: m.index,
          length: m[0].length,
          value: value
        }
      });
    });
    // Replace mustaches in text with resolved values
    _.resolvePromises(promises).then(function(items) {
      _.each(items, function(item) {
        var value = _.hasValue(item.value) ? item.value : '';
        text = text.substring(0, item.index) + value + text.substring(item.index + item.length);
      });
      // Return mangled text asynchronously..
      cb(text);
    });
    // ..and paths immediately
    return paths;
  };

  // Is the given obj a string describing a data path?
  var isPath = function(obj) {
    if(obj == 'true' || obj == 'false' || obj == 'null' || obj == '') return false;
    return obj.match && !!obj.match(/^!?[A-z][A-z0-9]*(\.[A-z][A-z0-9]*)*/);
  };

  // Convert camel cased model names to CSS notation
  var cssize = function(camel) {
    return camel;
  };

  // Evaluate a template expression
  var evalExpr = function(scope, expr, node) {
    var m;
    // Negation
    var negate = (expr[0] == '!');
    if(negate) expr = expr.slice(1);
    var ret;
    // Boolean
    if(expr == 'true') {
      ret = true;
    } else if(expr == 'false') {
      ret = false;
    // Null
    } else if(expr == 'null') {
      ret = null;
    // Number
    } else if(!isNaN(expr)) {
      ret = parseFloat(expr);
    // String
    } else if(m = (expr.match && expr.match(/^(["'])(.*)\1$/))) {
      ret = m[2];
    // Array
    } else if(m = expr.match(/^\[(.*)\]$/)) {
      ret = _.map(m[1].split(','), function(item) {
        return evalExpr(scope, item, node);
      });
    // Magic variable
    } else if(expr[0] == '$' && expr.slice(0, 5) != '$this') {
      var attrName = expr.slice(1);
      var attr = node.attributes[attrName];
      if(attr.type == 'static') {
        ret = attr.value;
      } else if(attr.type == 'dynamic') {
        ret = evalCompoundExpr(scope, attr.expression, node);
      }
    // Path
    } else if(isPath(expr) || expr.slice(0, 5) == '$this') {
      // Arguments for helper functions
      if(_.contains(expr, '(')) {
        var parts = expr.split('(');
        expr = parts[0];
        var args = parts[1].slice(0, -1).split(',');
        args = _.map(args, function(arg) {
          return evalExpr(scope, arg.trim(), node);
        });
        ret = _.resolvePromises(args).then(function(args) {
          return scope.resolvePath(expr, args).then(function(path) {
            return path.value;
          });
        });
      } else {
        ret = scope.resolvePath(expr).then(function(path) {
          return path.value;
        });
      }
    } else {
      console.error('Cannot evaluate expression "' + expr + '"');
    }
    return _.promiseFrom(ret).then(function(ret) {
      return negate ? !ret : ret;
    });
  };

  // Evaluate expression of alternating values and operators
  var evalCompoundExpr = function(scope, expr, node) {
    var booleans = ['||', '&&'];
    var comparisons = ['==', '!=', '>', '<', '>=', '<='];
    var allOps = _.union(booleans, comparisons);
    // Separate expression into values and operators
    var parts = _.map(expr.split(/(\|\||&&|==|!=|>|<|>=|<=)/), function(part) {
      return part.trim();
    });
    // Evaluate comparison operators first
    var compare = function(a, b, op) {
      return a.then(function(a) {
        return b.then(function(b) {
          if(op == '==') return a == b;
          if(op == '!=') return a != b;
          if(op == '>')  return a >  b;
          if(op == '<')  return a <  b;
          if(op == '>=') return a >= b;
          if(op == '<=') return a <= b;
        });
      });
    };
    var boolOps = [];
    var values = [];
    for(var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if(_.contains(booleans, part)) {
        // Boolean OP
        boolOps.push(part);
      } else if(_.contains(comparisons, part)) {
        // Comparison OP
        var a = values.pop();
        var b = evalExpr(scope, parts[i + 1], node);
        values.push(compare(a, b, part));
        i++;
      } else {
        // Value
        values.push(evalExpr(scope, part, node));
      }
    }
    // Eval boolean operators
    return _.resolvePromises(values).then(function(values) {
      var out = values.shift();
      _.each(values, function(value) {
        var op = boolOps.shift();
        if(op == '||') {
          out = out || value;
        } else if(op == '&&') {
          out = out && value;
        }
      });
      return out;
    });
  };

  // Return all paths used in the given compound expressions
  var detectCompoundPaths = function(expr) {
    // Extract undividual expressions
    var parts = _.map(expr.split(/\|\||&&|==|!=|>|<|>=|<=/), function(part) {
      return part.trim();
    });
    // Detect paths
    var paths = _.select(parts, function(part) {
      return isPath(part);
    });
    // Remove duplicates
    return _.unique(_.flatten(_.map(paths, function(path) {
      // Remove negation
      if(path[0] == '!') path = path.slice(1);
      // Path itself
      var ret = path.split('(');
      path = ret[0];
      // Method arguments can be paths as well
      var args = ret[1];
      if(args) {
        args = args.slice(0, -1).split(',');
        args = _.map(args, function(arg) {
          return arg.trim();
        });
      }
      var argPaths = _.select(args || [], function(arg) {
        return isPath(arg);
      });
      return [path].concat(argPaths);
    })));
  };

  var walkTheDOM = function(node, cb) {
    cb(node);
    node = node.firstChild;
    while(node) {
      walkTheDOM(node, cb);
      node = node.nextSibling;
    }
  };

  var walkChildren = function(node, cb) {
    node = node.firstChild;
    while(node) {
      if(cb(node)) return;
      node = node.nextSibling;
    }
  };

  var renderCb;
  var pending = 0;

  // Indicate an asynchronous section during evaluation
  var unfinish = function(frag) {
    frag.unfinish && frag.unfinish();
    pending++;
  };

  // Terminate an asynchronous section
  var finish = function(frag) {
    frag.finish && frag.finish();
    pending--;
    if(!pending) {
      renderCb && renderCb();
      renderCb = null;
    }
  };

  // Add main model to baseScope
  var baseScope = Scope().addLayer(mainModel);

  return {
    baseScope: baseScope,

    // Render the complete template
    // Returns a document fragment on the client and a virtual DOM on the server
    // The optional callback is called when all views have been fully resolved
    render: function(cb) {
      renderCb = cb;
      var frag = this.evaluate(topNode, this.baseScope);
      if(!pending) {
        _.defer(function() {
          renderCb && renderCb();
          renderCb = null;
        });
      }
      return frag;
    },

    // Evaluate the given node in the context of the given scope
    // Returns a document fragment
    evaluate: function(node, scope, preFormated) {
      var self = this;
      var frag = interface.createFragment();

      var recurse = function(frag, scope, pre) {
        _.each(node.children, function(child) {
          frag.appendChild(self.evaluate(child, scope, pre || preFormated));
        });
      };

      // Evaluate the whole tree
      if(node.type == 'TOP') {
        recurse(frag, scope);
      
      // Evaluate statement
      } else if(node.type == 'Statement') {
        switch(node.keyword) {
          
          case 'if':
            var elem = interface.createDOMElement('span', null, ['placeholder-if']);
            var alternatives = _.union([node], node.alternatives);
            var expressions = _.map(alternatives, 'expr');
            node.paths = _.unique(_.flatten(_.map(expressions, function(expr) {
              return detectCompoundPaths(expr);
            })));
            elem.node = node;
            elem.scope = scope;
            // Find first matching alternative
            var firstAlternative = function(index, cb) {
              var alt = alternatives[index];
              if(alt.expr) {
                // Resolve potential promises among values
                var promise = evalCompoundExpr(scope, alt.expr, node);
                var value = promise.then(function(value) {
                  if(value) {
                    cb(alt);
                  } else if(index < alternatives.length - 1) {
                    firstAlternative(index + 1, cb);
                  } else {
                    cb(null);
                  }
                });
              } else {
                // Fallback alternative
                cb(alt);
              }
            };
            unfinish(frag);
            firstAlternative(0, function(alt) {
              // Recurse into matching alternative
              if(alt) {
                _.each(alt.children, function(child) {
                  elem.appendChild(self.evaluate(child, scope));
                });
              }
              self.register(elem);
              finish(frag);
            });
            frag.appendChild(elem);
            break;
          
          case 'for':
            var elem = interface.createDOMElement('span', null, ['placeholder-for']);
            node.paths = [node.itemsPath];
            elem.node = node;
            elem.scope = scope;
            // Resolve actual iterable at path
            var items = evalExpr(scope, node.itemsPath, node);
            unfinish(frag);
            items.then(function(items) {
              // Render every child,
              // then register element for updates, should the whole collection be exchanged
              var loop = function(items) {
                _.each(items, function(item) {
                  self.renderLoopItem(item, elem);
                });
                self.register(elem);
              };
              // Resolve Query or Collection
              if(items.klass == 'Query' || items.klass == 'Collection') {
                elem.iterator = items;
                items.resolve(function(realItems) {
                  if(!realItems) realItems = _.clone(items.items);
                  loop(realItems);
                  // Update list when query changes
                  if(_.onClient()) {
                    elem.listHandler = items.on('change:size', function() {
                      items.resolve(function(newItems) {
                        if(!newItems) newItems = _.clone(items.items);
                        self.updateList(elem, realItems, newItems);
                        realItems = newItems;
                      });
                    });
                  }
                  finish(frag);
                });
              // Regular array
              } else if(Array.isArray(items)) {
                loop(items);
                finish(frag);
              } else {
                console.error('Cannot iterate over ' + node.itemsPath);
                finish(frag);
              }
            });
            frag.appendChild(elem);
            break;
          
          case 'view':
            var elem = interface.createDOMElement('span', null, ['placeholder-view']);
            var viewModel = viewModels[node.viewModel];
            if(node.viewModel && !viewModel) {
              console.error('View model not found: ' + node.viewModel);
            } else {
              if(viewModel) {
                // Evaluate constructor arguments
                var args = _.map(node.arguments, function(arg) {
                  return evalExpr(scope, arg, node);
                });
                unfinish(frag);
                _.resolvePromises(args).then(function(args) {
                  // Instantiate view model
                  viewModel.create(args, elem).then(function(view) {
                    // Add view model instance to new scope level
                    var newScope = scope.clone().addLayer(view).addLayer({$this: view});
                    view.scope = newScope;
                    elem.view = view;
                    recurse(elem, newScope);
                    finish(frag);
                    //XXX A view should be able to tell when all children have
                    //XXX fully rendered and emit its attach event afterwards
                  });
                });
              } else {
                // Allow view statement without view model as a way to create a new scope
                recurse(elem, scope.clone());
              }
            }
            frag.appendChild(elem);
            break;
          
          case 'import':
            var elem = interface.createDOMElement('span', null, ['placeholder-import']);
            node.paths = _.select(_.values(node.arguments), function(v) { return isPath(v) });
            elem.node = node;
            elem.scope = scope;
            // Render indented nodes for placement using content statement
            var contentFrag = interface.createDOMElement('span', null, ['content-fragment']);
            recurse(contentFrag, scope);
            // Look up arguments in scope
            var args = _.map(node.arguments, function(expr) {
              return evalExpr(scope, expr, node);
            });
            unfinish(frag);
            _.resolvePromises(args).then(function(args) {
              args._content = contentFrag;
              // Recurse into different template with a fresh scope
              var importedNode = parseTrees[node.templateName];
              var newScope = Scope().addLayer(mainModel).addLayer(args);
              elem.appendChild(self.evaluate(importedNode, newScope));
              self.register(elem);
              finish(frag);
            });
            frag.appendChild(elem);
            break;
          
          case 'content':
            //XXX unfinish?
            scope.resolvePath('_content').then(function(path) {
              frag.appendChild(path.value);
            });
            break;
          
          case 'client':
            if(_.onClient()) {
              recurse(frag, scope);
            } else if(node.alternatives) {
              _.each(node.alternatives[0].children, function(child) {
                frag.appendChild(self.evaluate(child, scope));
              });
            }
            break;
          
          case 'route':
            var vars = {};
            var elem = interface.createDOMElement('span', null, ['placeholder-route']);
            var alternatives = _.union([node], node.alternatives);
            var routes = _.map(alternatives, 'expr');
            // Find the first route that matches
            var params;
            var resolvedParams = _.resolvePromises(_.map(alternatives, function(alt) {
              var route = alt.expr;
              if(!route) return;
              // Extract params from current URL
              return scope.resolvePath('_page').then(function(path) {
                var url = path.value;
                return _.extractUrlParams(url, route);
              })
            }));
            unfinish(frag);
            resolvedParams.then(function(resolvedParams) {
              var alternative = _.find(alternatives, function(alt, i) {
                params = resolvedParams[i];
                return !!params;
              });
              // Use fallback if no other route matched
              if(!alternative) {
                var last = _.last(alternatives);
                if(!last.expr) {
                  alternative = last;
                }
              }
              // Fresh scope level
              var newScope = scope.clone();
              if(params) {
                newScope.addLayer(params);
              }
              // Recurse into matching route
              _.each(alternative.children, function(child) {
                elem.appendChild(self.evaluate(child, newScope));
              });
              node.paths = ['_page'];
              elem.node = node;
              elem.scope = scope;
              self.register(elem);
              finish(frag);
            });
            frag.appendChild(elem);
            break;
        }
      
      // Evaluate HTML tag
      } else if(node.type == 'HTMLTag') {
        // Don't regenerate script tags as these
        // would be downloaded and reexecuted each time
        if(node.tag == 'script' && _.onClient()) return frag;
        var elem = interface.createDOMElement(node.tag, node.id, node.classes);
        elem.node = node;
        elem.scope = scope;
        // Resolve attribute values, collect two-way binding expressions, collect binding paths
        var paths = [];
        var attributePaths = [];
        var twoWayBindings = {};
        var promises = _.compact(_.flatten(_.values(_.map(node.attributes, function(attr, key) {
          // Dynamic attribute
          if(attr.type == 'dynamic') {
            var expr = attr.expression;
            // Collect two way binding
            if(_.last(expr) == '!') {
              expr = expr.slice(0, -1);
              // .. with auto save
              var save = false;
              if(_.last(expr) == '!') {
                expr = expr.slice(0, -1);
                save = true;
              }
              twoWayBindings[key] = {expr: expr, save: save};
            }
            // One time only binding? -> Otherwise register for updates
            if(!attr.oneTimeOnly) {
              attributePaths.push({
                type: 'dynamic',
                key: key,
                expr: expr,
                paths: detectCompoundPaths(expr)
              });
            }
            // Resolve attribute value
            return self.updateAttribute(elem, key, expr);
          // CSS class selector
          } else if(attr.type == 'CSS') {
            return _.values(_.map(attr.classes, function(expr, klassName) {
              if(!attr.oneTimeOnly) {
                attributePaths.push({
                  type: 'CSS',
                  klassName: klassName,
                  expr: expr,
                  paths: detectCompoundPaths(expr)
                });
              }
              return self.updateCssClass(elem, klassName, expr);
            }));
          // Static attribute
          } else {
            elem.setAttribute(key, attr.value);
          }
        }))));
        // Resolve asynchronous attribute values
        if(_.keys(promises).length) {
          unfinish(frag);
          _.resolvePromises(promises).then(function() {
            finish(frag);
          });
        }
        // Register two-way bindings
        if(Object.keys(twoWayBindings).length) {
          var eventName = (elem.tagName == 'INPUT' && elem.type == 'text') ? 'keyup' : 'change';
          elem.addEventListener(eventName, function() {
            _.each(twoWayBindings, function(binding, attr) {
              scope.resolvePath(binding.expr).then(function(path) {
                var ref = path.ref;
                var value;
                var booleans = ['checked', 'selected', 'disabled', 'readonly', 'multiple', 'defer', 'declare', 'noresize'];
                if(_.contains(booleans, attr)) {
                  // Boolean input
                  value = !!elem[attr];
                } else if(attr == 'value') {
                  // String input
                  value = elem.value;
                  // Numeric input
                  if(elem.tagName == 'INPUT' && elem.type == 'number') {
                    value = parseFloat(value);
                  }
                } else {
                  console.error('Trying to activate two-way binding from unknown attribute');
                }
                if(ref.obj.klass == 'Instance') {
                  ref.obj.set(ref.key, value);
                } else {
                  ref.obj[ref.key] = value;
                  ref.lastInstance.emit('change:' + ref.lastInstanceKey);
                }
                // Also save if two exclamation marks were used
                if(binding.save) ref.lastInstance.save();
              });
            });
          });
        }
        // Execute embeded statements
        self.execMicroStatements(node.statements, elem);
        // Nodes have either content or children
        if(node.content) {
          // Replace mustaches with actual values
          unfinish(frag);
          var mustachePaths = resolveMustaches(node.content, scope, node, function(text) {
            elem.innerHTML = text;
            finish(frag);
          });
          // Save binding paths for future updates
          paths = _.union(paths, mustachePaths);
        } else {
          recurse(elem, scope, (node.tag == 'script' || node.tag == 'pre'));
        }
        // If node had either dynamic content or dynamic attributes -> register for updates
        if(paths.length || attributePaths.length) {
          node.paths = paths; //XXX Should it be elem.paths?
          node.attributePaths = attributePaths;
          self.register(elem);
        }
        frag.appendChild(elem);
      
      // Evaluate free text
      } else if(node.type == 'Text') {
        var text;
        if(preFormated) {
          text = interface.createTextNode(node.content);
        } else {
          text = interface.createDOMElement('span');
          text.innerHTML = node.content;
        }
        frag.appendChild(text);
      }
      return frag;
    },

    execMicroStatements: function(statements, elem) {
      _.each(statements, function(statement) {
        // Register action handlers
        if(statement.statement == 'on' && _.onClient()) {
          var eName = statement.event;
          // Map virtual events to real DOM events
          var condition = function() { return true };
          var lastClickTime;
          // Enter event
          if(eName == 'enter') {
            eName = 'keyup';
            condition = function(e) {
              return e.keyCode == 13;
            };
          // Escape event
          } else if(eName == 'escape') {
            eName = 'keyup';
            condition = function(e) {
              return e.keyCode == 27;
            };
            // Double click event
          } else if(eName == 'doubleClick') {
            eName = 'click';
            condition = function(e) {
              var t = (new Date()).getTime();
              var ret = (lastClickTime && t - lastClickTime < 500);
              lastClickTime = t;
              return ret;
            };
          }
          // Listen to real DOM event
          elem.addEventListener(eName, function(e) {
            if(!condition(e)) return;
            e.preventDefault();
            // Evaluate arguments to be passed to the method
            var args = _.map(statement.args, function(arg) {
              return evalExpr(elem.scope, arg, elem.node);
            });
            return _.resolvePromises(args).then(function(args) {
              // Call action method
              // The method may prevent event bubbling by returning false
              return elem.scope.resolvePath(statement.method, _.union([e], args)).then(function(path) {
                return path.value;
              });
            });
          });
        
        // Add a variable pointing to the current element to the scope
        } else if(statement.statement == 'as') {
          elem.scope.addLayer().getTopLayer()[statement.varName] = elem;
        }
      });
    },

    // Append item to list that's already hooked into the DOM
    renderLoopItem: function(item, loopElem) {
      var self = this;
      var node = loopElem.node;
      var itemData;
      // Long form with variable name
      if(node.itemPath) {
        itemData = {};
        itemData[node.itemPath] = item;
      // Short form
      } else {
        itemData = item;
      }
      if(node.children.length) {
        var newScope = loopElem.scope.clone().addLayer(itemData).addLayer({$this: item});
        // Recurse
        _.each(node.children, function(child) {
          child = self.evaluate(child, newScope).firstChild;
          // Stick item to DOM node to allow for identifying it later
          child.iteratorItem = item;
          loopElem.appendChild(child);
        });
      }
    },

    // Register the given element for updates,
    // should the data at one of its paths change
    register: function(elem) {
      var self = this;
      if(_.onServer()) return;
      elem.handlers = [];
      // Bind one handler for every path
      _.each(elem.node.paths, function(path) {
        self.registerPath(elem, path, true, function() {
          self.updateElement(elem);
        });
      });
      _.each(elem.node.attributePaths, function(attrPath) {
        _.each(attrPath.paths, function(path) {
          self.registerPath(elem, path, false, function() {
            if(attrPath.type == 'dynamic') {
              self.updateAttribute(elem, attrPath.key, attrPath.expr);
            } else if(attrPath.type == 'CSS') {
              self.updateCssClass(elem, attrPath.klassName, attrPath.expr);
            }
          });
        });
      });
    },

    // Register a callback to be called when the data at <path> changes
    registerPath: function(elem, path, onceOnly, cb) {
      if(!isPath(path)) {
        console.error("Should not happen");
        return;
      }
      // Resolve actual instance the path points to
      return elem.scope.resolvePath(path).then(function(path) {
        var reference = path.ref;
        if(reference.lastInstance && reference.lastInstance.once) {
          // Listen for changes of the individual property
          var handler = (onceOnly ? reference.lastInstance.once('change:' + reference.lastInstanceKey, cb) : 
                                    reference.lastInstance.on('change:' + reference.lastInstanceKey, cb));
          elem.handlers.push({handler: handler, obj: reference.lastInstance});
        }
      });
    },

    // Unbind event handlers and discard views for all elements below this one
    unregister: function(elem) {
      walkTheDOM(elem, function(child) {
        //XXX Unbind action handlers
        // $(child).off();
        // Unbind model events
        _.each(child.handlers, function(h) {
          h.obj.off(h.handler);
        });
        delete child.handlers;
        // Allow view models to dispose of manually allocated resources
        if(child.view) {
          child.view.emit('remove');
          child.view.discardEventHandlers();
          delete child.view;
        }
        // Remove list handler
        if(child.iterator) {
          child.iterator.off(child.listHandler);
          delete child.iterator;
          delete child.listHandler;
        }
        if(child.iteratorItem) {
          delete child.iteratorItem;
        }
      });
    },

    // Replace DOM from this node downward with an updated version
    updateElement: function(elem) {
      var self = this;
      self.unregister(elem);
      if(elem.parentNode) {
        // Build separate evaluator for element's node
        var evaluator = Evaluator(elem.node, viewModels, parseTrees, interface, mainModel);
        evaluator.baseScope = elem.scope.clone();
        var frag = evaluator.render(function() {
          // Replace old element once rendering has completely finished
          self.unregister(elem);
          if(elem.parentNode) elem.parentNode.replaceChild(frag, elem);
        });
      }
    },

    // Set or remove attribute according to given expression
    updateAttribute: function(elem, key, expr) {
      var value = evalCompoundExpr(elem.scope, expr, elem.node);
      return value.then(function(value) {
        if(_.hasValue(value)) {
          // Boolean attribute
          if(value === true || value === false) {
            if(value) {
              elem.setAttribute(key, true);
            } else {
              elem.removeAttribute(key);
            }
          } else {
            // Don't override CSS classes used in template
            if(key == 'class' && elem.node.classes) {
              value = elem.node.classes.join(' ') + ' ' + value;
            }
            elem.setAttribute(key, value);
          }
        } else {
          elem.removeAttribute(key);
        }
      });
    },

    // Add or remove the given class name according to given expression
    updateCssClass: function(elem, klassName, expr) {
      var value = evalCompoundExpr(elem.scope, expr, elem.node);
      return value.then(function(bool) {
        if(bool) {
          if(!_.contains(elem.className, klassName)) elem.className += ' ' + klassName;
          // elem.classList.add(klassName);
        } else {
          elem.className = elem.className.replace(klassName, '');
          // elem.classList.remove(klassName);
        }
      });
    },

    // Create and delete DOM elements as neccessary to match the new list
    updateList: function(elem, oldItems, newItems) {
      var self = this;
      // Diff lists
      var obsoleteItems = _.select(oldItems, function(old) { return !_.contains(newItems, old) });
      var freshItems = _.select(newItems, function(fresh) { return !_.contains(oldItems, fresh) });
      // Remove old elements
      _.each(obsoleteItems, function(item) {
        walkChildren(elem, function(child) {
          if(child.iteratorItem == item) {
            self.unregister(child);
            elem.removeChild(child);
            return true;
          }
        });
      });
      // Add new items
      _.each(freshItems, function(item) {
        self.renderLoopItem(item, elem);
      });
      //XXX Maintain order
    }
  };
};


module.exports = Evaluator;
