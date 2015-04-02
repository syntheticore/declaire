var Utils = require('./utils.js');
var Scope = require('./scope.js');


var Evaluator = function(topNode, viewModels) {

  // Create a fresh, jQuery-wrapped DOM element
  var createDOMElement = function(tag, id, classes, attributes) {
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
    return $(html);
  };

  // Replace all mustaches in text with the value of their paths
  var resolveMustaches = function(text, scope) {
    var paths = [];
    _.each(Utils.scan(text, /{(.*?)}/g).reverse(), function(m) {
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
      var frag = $(document.createDocumentFragment());
      var recurse = function(frag, scope) {
        _.each(node.children, function(child) {
          frag.append(self.evaluate(child, scope));
        });
      };
      if(node.type == 'Instruction') {
        var evaluateIf = function(expressions, condition) {
          var elem = createDOMElement('span', null, ['placeholder']);
          frag.append(elem);
          var values = _.map(expressions, function(expr) {
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
          case 'for':
            var elem = createDOMElement('span', null, ['placeholder']);
            frag.append(elem);
            var items = evalExpr(scope, node.itemsPath);
            node.paths = [node.itemsPath];
            items.each(function(item) {
            // for(var i in items) {
            //   var item = items[i];
              var itemData = {};
              itemData[node.itemPath] = item;
              if(node.children.length) {
                var newScope = scope.clone().addLayer(itemData);
                recurse(elem, newScope);
              }
            // }
            });
            elem.node = node;
            elem.scope = scope;
            self.register(elem);
            break;
          case 'view':
            // var viewModel = eval(node.viewModel);
            var viewModel = viewModels[node.viewModel];
            if(!viewModel) throw 'View model not found: ' + node.viewModel;
            viewModel.create(function(view) {
              //XXX Set view.$el
              var newScope = scope.clone().addLayer(view);
              view.$el = $('body');
              view.scope = newScope;
              recurse(frag, newScope);
            });
            break;
        }
      } else if(node.type == 'HTMLTag') {
        // Don't regenerate script tags as these
        // would be downloaded and reexecuted each time
        if(node.tag == 'script') return frag;
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
        var elem = createDOMElement(node.tag, node.id, node.classes, attributes);
        // Nodes have either content or children
        if(node.content) {
          if(hasMustaches(node.content)) {
            var resolved = resolveMustaches(node.content, scope);
            elem.text(resolved.text);
            paths = _.union(paths, resolved.paths);
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
          for(var action in node.actions) {
            var method = node.actions[action];
            //XXX Remove handler when a parent gets updated
            elem.on(action, function() {
              scope.resolvePath(method);
              //XXX Read text from inputs and supply as argument to method
            });
          }
        // }
        frag.append(elem);
      } else if(node.type == 'Text') {
        frag.append(node.content);
      } else if(node.type == 'TOP') {
        recurse(frag, scope);
      }
      return frag;
    },

    // Replace DOM from this node downward with an updated version
    updateElement: function(elem) {
      //XXX Unbind event handlers for all elements below this one first
      _.each(elem.handlers, function(h) {
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
      elem.handlers = [];
      _.each(elem.node.paths, function(path) {
        if(isPath(path)) {
          var reference = elem.scope.resolvePath(path).ref;
          if(reference.obj.model) {
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


var DOMInterface = {
  createFragment: function() {
    return $(document.createDocumentFragment());
  },

  createDOMElement: function(tag, id, classes, attributes) {
    var elem = document.createElement(tag);
    elem.id = id;
    elem.className = classes.join(' ');
    Utils.each(attributes, function(value, key) {
      elem.setAttribute(key, value);
    });
    return $(elem);
  }
};


var StreamInterface = {
  createFragment: function() {
    return {
      _fragment: true,
      children: [],

      append: function(elem) {
        this.children.push(elem);
      },

      serialize: function() {
        var html = '';
        Utils.each(this.children, function(child) {

        });
      }
    };
  },

  createDOMElement: function(tag, id, classes, attributes) {
    return {
      tag: tag,
      id: id,
      classes: classes,
      attributes: attributes,
      children: [],

      on: function() {
        // Don't register actions handlers on the server
      },

      append: function(elem) {
        this.children.push(elem);
      },

      serialize: function(fillCb, finalCb) {
        var html = '<' + this.tag;
        var addAttr = function(key, val) {
          if(!val) return;
          html += ' ' + key + '="' + val + '"';
        };
        if(this.id) addAttr('id', this.id);
        if(this.classes && this.classes.length) addAttr('class', this.classes.join(' '));
        if(this.attributes) {
          for(var attr in this.attributes) {
            var val = this.attributes[attr];
            addAttr(attr, val);
          }
        }
        html += '>';
        fillCb(function() {

        });
        return html.toString();
      }
    };
  }
};


module.exports = Evaluator;
