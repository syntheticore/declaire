var _ = require('./utils.js');


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
    _.each(lines, function(line) {
      lineNum++;
      if(!line) return;
      // Remove indentation
      var indent = Math.max(0, line.search(/\S/));
      line = line.slice(indent);
      indent /= self.indentSpaces;
      // Ignore comments
      var ci = line.indexOf('//');
      if(ci == 0) return;
      // Ignore empty lines
      if(!line.replace(/\s/g, '').length) return;
      // Parse individual parts from line
      var node = self.parseLine(line);
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
      // Add the generated node to its parent
      stack[stack.length - 1].children.push(node);
      lastIndent = indent;
      lastNode = node;
    });
    return top;
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
    var m = line.match(/([\w-#\.]+>)*([\w-]+)?(#([\w-]+))?((\.[\w-]+)*)(\((.*)\))?( (.*))?/);
    var multiTags = m[1];
    var tag = m[2] || 'div';
    var id = m[4];
    var classes = m[5] ? m[5].slice(1).split('.') : [];
    var inParens = m[8];
    var content = m[10];
    var attributes = {};
    var actions = {};
    // Parse attributes
    if(inParens) {
      var attrDefinitions;
      var actionDefinitions;
      var i = inParens.indexOf('{{');
      if(i > -1) {
        attrDefinitions = inParens.slice(0, i);
        actionDefinitions = inParens.slice(i, inParens.length);
      } else {
        attrDefinitions = inParens;
      }
      _.each(_.scan(attrDefinitions, /([\w-]+?)=(['"])(.+?)\2\s?/g), function(m) { // '
        var key = m[1];
        var value = m[3];
        attributes[key] = value;
      });
      _.each(_.scan(actionDefinitions, /{{(\w+)\s(\w+)\s(\w+)}}/g), function(m) {
        actions[m[2]] = m[3];
      });
    }
    // Make AST node
    var tag = {
      type: 'HTMLTag',
      tag: tag,
      id: id,
      classes: classes,
      attributes: attributes,
      content: content,
      actions: actions,
      children: []
    };
    // Build a hierarchy from multi tags
    if(multiTags) {
      multiTags = multiTags.slice(0, -1);
      var tags = _.map(multiTags.split('>'), function(t) {
        return self.parseTag(t);
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

  // Takes an statement line and creates the approriate node
  parseStatement: function(line) {
    var m;
    // if
    if(m = line.match(/{{if\s+(.+)}}/)) {
      return {
        type: 'Statement',
        keyword: 'if',
        path: m[1],
        children: []
      };
    // if-greater
    } else if(m = line.match(/{{if-greater\s+(.+)\s+(.+)}}/)) {
      return {
        type: 'Statement',
        keyword: 'if-greater',
        path1: m[1],
        path2: m[2],
        children: []
      };
    // if-equal
    } else if(m = line.match(/{{if-equal\s+(.+)\s+(.+)}}/)) {
      return {
        type: 'Statement',
        keyword: 'if-equal',
        path1: m[1],
        path2: m[2],
        children: []
      };
    // if-not-equal
    } else if(m = line.match(/{{if-not-equal\s+(.+)\s+(.+)}}/)) {
      return {
        type: 'Statement',
        keyword: 'if-not-equal',
        path1: m[1],
        path2: m[2],
        children: []
      };
    // for
    } else if(m = line.match(/{{for\s+(\w+)\s+in\s+(.+)}}/)) {
      return {
        type: 'Statement',
        keyword: 'for',
        itemPath: m[1],
        itemsPath: m[2],
        children: []
      };
    // view
    } else if(m = line.match(/{{view\s+(\w+)?(\(.*\))?}}/)) {
      var parens = m[2];
      var args = parens ? _.map(parens.slice(1, -1).split(','), function(argument) {
        return argument.replace(/\s/g, '');
      }) : [];
      return {
        type: 'Statement',
        keyword: 'view',
        viewModel: m[1],
        arguments: args,
        children: []
      };
    // import
    } else if(m = line.match(/{{import\s+(\w+)(\(.*\))?}}/)) {
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
      return {
        type: 'Statement',
        keyword: 'import',
        templateName: m[1] + '.tmpl',
        arguments: args,
        children: []
      };
    // content
    } else if(m = line.match(/{{content}}/)) {
      return {
        type: 'Statement',
        keyword: 'content',
        children: []
      };
    } else {
      throw('Unknown statement: ' + line);
    }
  }
};


module.exports = Parser;
