var Utils = require('./utils.js');


var DOMInterface = {
  createFragment: function() {
    return $(document.createDocumentFragment());
  },

  createDOMElement: function(tag, id, classes, attributes) {
    var elem = document.createElement(tag);
    if(id) elem.id = id;
    if(classes.length) elem.className = classes.join(' ');
    Utils.each(attributes, function(value, key) {
      // if(['checked', 'selected', 'disabled', 'readonly', 'multiple', 'defer', 'declare', 'noresize'].indexOf(key) != -1) {
      // } else {
      //   elem.setAttribute(key, value);
      // }
      elem[key] = value;
    });
    return $(elem);
  }
};


module.exports = DOMInterface;
