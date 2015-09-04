var $ = require('jquery');
var _ = require('./utils.js');


// When passed to the template evaluator,
// its render method will create actual DOM elements
var DOMInterface = function() {
  return {
    createFragment: function() {
      return document.createDocumentFragment();
    },

    createDOMElement: function(tag, id, classes, attributes) {
      var elem = document.createElement(tag);
      if(id) elem.id = id;
      if(classes && classes.length) elem.className = classes.join(' ');
      if(attributes) {
        _.each(attributes, function(value, key) {
          elem.setAttribute(key, value);
        });
      }
      return elem;
    },

    createTextNode: function(text) {
      return document.createTextNode(text);
    }
  };
};


module.exports = DOMInterface;
