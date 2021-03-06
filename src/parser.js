var _ = require('./utils.js');


// Breadth-first walk the tree in reverse order
var inverseBreadth = function(node, cb) {
  if(!node.children) return;
  for(var i = node.children.length - 1; i >= 0; i--) {
    cb(node.children[i]);
  };
  _.each(node.children, function(child) {
    inverseBreadth(child, cb);
  });
};

// Clean tree from alternatives and temporary data
var cleanTree = function(node) {
  if(node.children) {
    for(var i = node.children.length - 1; i >= 0; i--) {
      var child = node.children[i];
      if(child.type == 'Alternative') {
        node.children.splice(i, 1);
      }
    }
  }
  var children = _.flatten(_.union(node.children, node.alternatives));
  _.each(children, function(child) {
    cleanTree(child);
  })
  delete node.slurpy;
  if(node.attributes && !_.keys(node.attributes).length) delete node.attributes;
  if(node.statements && !node.statements.length) delete node.statements;
  if(node.children && !node.children.length) delete node.children;
  if(node.classes && !node.classes.length) delete node.classes;
  return node;
};


var Parser = {
  indentSpaces: 2,

  // Parse the given template source and spit out a traversable tree
  parseTemplate: function(tmpl) {
    var self = this;
    var lines = tmpl.split('\n');
    var lastIndent = 0;
    var lineNum = 0;
    var top = {
      type: 'TOP',
      children: []
    };
    var lastNode = top;
    var stack = [top];
    var slurpyMode = false;
    _.each(lines, function(line) {
      lineNum++;
      var indent = Math.max(0, line.search(/\S/)) / self.indentSpaces;
      // Regard anything below a slurpy tag as text
      if(slurpyMode && (indent > lastIndent || !line.replace(/\s/g, '').length)) {
        var parent = lastNode;
        parent.children.push({
          type: 'Text',
          content: line.slice(lastIndent * self.indentSpaces + self.indentSpaces) + '\n'
        });
        return;
      }
      slurpyMode = false;
      // Remove indentation
      line = line.slice(indent * self.indentSpaces);
      // Ignore comments
      var ci = line.indexOf('//');
      if(ci == 0) return;
      // Ignore empty lines
      if(!line.replace(/\s/g, '').length) return;
      // Push and pop the current parent from the stack
      // as dictated by indentation
      if(indent > lastIndent) {
        if(indent - lastIndent > 1) {
          throw({message: 'Too much indentation', lineNum: lineNum});
        }
        if(lastNode.content) throw({message: 'Elements cannot have both text and children elements', lineNum: lineNum});
        stack.push(lastNode);
      } else if(indent < lastIndent) {
        _.times(lastIndent - indent, function() {
          stack.pop();
        });
      }
      var node = self.parseLine(line);
      // Add the generated node to its parent
      var parent = _.last(stack);
      parent.children.push(node);
      // If we have a multiTags hierarchy -> use rightmost child as lastNode
      var child = node;
      while(child.children && child.children[0]) {
        child = child.children[0];
      };
      lastIndent = indent;
      lastNode = child;
      if(node.slurpy) {
        slurpyMode = true;
      }
    });
    // Squash alternatives into their respective statements
    var previous;
    var alternativeStack = [];
    inverseBreadth(top, function(node) {
      // Collect alternatives from bottom to top
      if(node.type == 'Alternative') {
        alternativeStack.push(node);
      // Attach to next statement we encounter
      } else {
        if(alternativeStack.length) {
          node.alternatives = alternativeStack.reverse();
          alternativeStack = [];
        }
      }
      previous = node;
    });
    // Remove alternatives
    return cleanTree(top);
  },

  // Convert line into tree node
  parseLine: function(line) {
    // Statement
    if(line.indexOf('{{') == 0) {
      return this.parseStatement(line);
    // Text
    } else if(line.indexOf('|') == 0) {
      return {
        type: 'Text',
        content: line.slice(2) + '\n'
      };
    // Tag definition
    } else {
      return this.parseTag(line);
    }
  },

  // Parse all major components from a tag, including inline content
  parseTag: function(line) {
    var self = this;
    var m = line.match(/(([\w-#\.]+\s*>\s*)*)([\w-]+)?(#([\w-]+))?((\.[\w-]+)*)(\((.*)\))?(\+)?( (.*))?/);
    var multiTags = m[1];
    var tag = m[3] || 'div';
    var id = m[5];
    var classes = m[6] ? m[6].slice(1).split('.') : [];
    var inParens = m[9];
    var plus = m[10];
    var content = m[12];
    var attributes = {};
    var statements = [];
    // Parse attributes
    if(inParens) {
      var attrDefinitions;
      var i = inParens.indexOf('{{');
      if(i > -1) {
        attrDefinitions = inParens.slice(0, i);
        var statementDefinitions = inParens.slice(i, inParens.length);
        statements = self.parseMicroStatements(statementDefinitions);
      } else {
        attrDefinitions = inParens;
      }
      _.each(_.scan(attrDefinitions, /([\w-]+?)\s*=\s*(['"])(.+?)\2\s?/g), function(m) { // '
        var key = m[1];
        var value = m[3];
        attributes[key] = self.parseAttribute(value);
      });
      // _.each(_.scan(statementDefinitions, /{{(\w+)\s+(\w+)\s+(\w+)}}/g), function(m) {
      //   statements[m[2]] = m[3];
      // });
    }
    // Make AST node
    var tag = {
      type: 'HTMLTag',
      tag: tag,
      id: id,
      classes: classes,
      attributes: attributes,
      content: content,
      statements: statements,
      slurpy: !!plus,
      children: []
    };
    // Build a hierarchy from multi tags
    if(multiTags) {
      // Remove trailing '>' before splitting
      multiTags = multiTags.trim().slice(0, -1);
      var tags = _.map(multiTags.split('>'), function(t) {
        return self.parseTag(t.trim());
      });
      var top = tags.shift();
      var prev = top;
      _.each(tags, function(t) {
        prev.children.push(t);
        prev = t;
      });
      prev.children.push(tag);
      return top;
    } else {
      return tag;
    }
  },

  parseAttribute: function(str) {
    var attr = {type: 'static', value: str};
    // Dynamic attribute
    if(str[0] == '{') {
      // Trim off curlies
      var expr = str.slice(1, -1);
      // One time only binding?
      var oneTime = (expr[0] == ':');
      if(oneTime) expr = expr.slice(1);
      // CSS class chooser?
      var m;
      if(m = expr.match(/((\w+):\s*([^,]+))+/g)) {
        var classes = {};
        _.each(m, function(match) {
          var parts = match.split(':');
          var className = parts[0];
          var expr = parts[1].trim();
          // Trim off parens from compound expressions
          if(expr[0] == '(') expr = expr.slice(1, -1);
          classes[className] = expr;
        });
        //XXX oneTimeOnly should exist for every expression
        return {type: 'CSS', classes: classes, oneTimeOnly: oneTime};
      } else {
        return {type: 'dynamic', expression: expr, oneTimeOnly: oneTime};
      }
    // Static attribute
    } else {
      return {type: 'static', value: str};
    }
  },

  parseMicroStatements: function(string) {
    var statements = [];
    _.each(_.scan(string, /{{(\w+)\s+(.*?)}}/g), function(m) {
      var statement = m[1];
      var rest = m[2];
      // as
      if(statement == 'as') {
        statements.push({statement: 'as', varName: rest});
      
      // on
      } else if(statement == 'on') {
        var m = rest.match(/(\w+)\s+(\$?[\w\.]+)(\((.+)\))?/);
        var args = m[4] && _.map(m[4].split(','), function(arg) { return arg.trim() });
        statements.push({statement: 'on', event: m[1], method: m[2], args: args});
      
      } else {
        throw('Unknown statement: ' + statement);
      }
    });
    return statements;
  },

  // Takes an statement line and creates the approriate node
  parseStatement: function(line) {
    var m;
    var out;
    // if
    if(m = line.match(/{{if\s+(.+)}}/)) {
      out = {
        type: 'Statement',
        keyword: 'if',
        expr: m[1]
      };
    // for
    } else if(m = line.match(/{{for\s+((\w+)\s+in\s+)?(.+)}}/)) {
      out = {
        type: 'Statement',
        keyword: 'for',
        itemPath: m[2],
        itemsPath: m[3]
      };
    // view
    } else if(m = line.match(/{{view\s+(\w+)?(\(.*\))?}}/)) {
      var parens = m[2];
      var args = parens ? _.map(parens.slice(1, -1).split(','), function(argument) {
        return argument.replace(/\s/g, '');
      }) : [];
      out = {
        type: 'Statement',
        keyword: 'view',
        viewModel: m[1],
        arguments: args
      };
    // import
    } else if(m = line.match(/{{import\s+([\w\/]+)(\(.*\))?}}/)) {
      var parens = m[2];
      var args = {};
      if(parens) {
        _.each(parens.slice(1, -1).split(','), function(argument) {
          var pair = argument.replace(/\s/g, '').split(':');
          var vari = pair[0];
          var expr = pair[1];
          args[vari] = expr;
        });
      }
      out = {
        type: 'Statement',
        keyword: 'import',
        templateName: m[1] + '.dcl',
        arguments: args
      };
    // content
    } else if(m = line.match(/{{content}}/)) {
      out = {
        type: 'Statement',
        keyword: 'content'
      };
    // client
    } else if(m = line.match(/{{client}}/)) {
      out = {
        type: 'Statement',
        keyword: 'client'
      };
    // route
    } else if(m = line.match(/{{route (.*)}}/)) {
      out = {
        type: 'Statement',
        keyword: 'route',
        expr: m[1]
      };
    // =>
    } else if(m = line.match(/{{=>\s*(.*)}}/)) {
      out = {
        type: 'Alternative',
        expr: m[1]
      };
    } else {
      throw('Unknown statement: ' + line);
    }
    out.children = [];
    return out;
  }
};

module.exports = Parser;
