var _ = require('underscore');
var Utils = require('./utils');


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
      // // Strip off inline comments
      // if(ci != -1) {
      //   line = line.slice(0, ci);
      // }
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
    // var template = Object.create(Template);
    // template.topNode = top;
    return top;
  },

  // Convert line into tree node
  parseLine: function(line) {
    // Instruction
    if(line.indexOf('{{') == 0) {
      return this.parseInstruction(line);
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
    var m = line.match(/([\w-]+)?(#([\w-]+))?((\.[\w-]+)*)(\((.*)\))?( (.*))?/);
    var tag = m[1] || 'div';
    var id = m[3];
    var classes = m[4] ? m[4].slice(1).split('.') : [];
    var inParens = m[7];
    var content = m[9];
    var attributes = {};
    var actions = {};
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
      _.each(Utils.scan(attrDefinitions, /([\w-]+?)=(['"])(.+?)\2\s?/g), function(m) { // '
        var key = m[1];
        var value = m[3];
        attributes[key] = value;
      });
      _.each(Utils.scan(actionDefinitions, /{{(\w+)\s(\w+)\s(\w+)}}/g), function(m) {
        actions[m[2]] = m[3];
      });
    }
    return {
      type: 'HTMLTag',
      tag: tag,
      id: id,
      classes: classes,
      attributes: attributes,
      content: content,
      actions: actions,
      children: []
    };
  },

  // Takes an instruction line and creates the approriate node
  parseInstruction: function(line) {
    var m;
    if(m = line.match(/{{if\s+(.+)}}/)) {
      // if
      return {
        type: 'Instruction',
        keyword: 'if',
        path: m[1],
        children: []
      };
    } else if(m = line.match(/{{if-greater\s+(.+)\s+(.+)}}/)) {
      // if-greater
      return {
        type: 'Instruction',
        keyword: 'if-greater',
        path1: m[1],
        path2: m[2],
        children: []
      };
    } else if(m = line.match(/{{if-equal\s+(.+)\s+(.+)}}/)) {
      // if-greater
      return {
        type: 'Instruction',
        keyword: 'if-equal',
        path1: m[1],
        path2: m[2],
        children: []
      };
    } else if(m = line.match(/{{for\s+(\w+)\s+in\s+(.+)}}/)) {
      // for
      return {
        type: 'Instruction',
        keyword: 'for',
        itemPath: m[1],
        itemsPath: m[2],
        children: []
      };
    } else if(m = line.match(/{{view\s+(\w+)}}/)) {
      // view
      return {
        type: 'Instruction',
        keyword: 'view',
        viewModel: m[1],
        children: []
      };
    } else {
      throw('Unknown instruction: ' + line);
    }
  }
};


module.exports = Parser;
