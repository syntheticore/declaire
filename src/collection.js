var Utils = require('./utils.js');
var eventMethods = require('./events.js');


var Collection = function(model) {
  var items = [];

  return Utils.merge(eventMethods, {
    klass: 'Collection',
    listeners: [],

    add: function(item) {
      items.push(item);
      this.emit('add');
      this.emit('change', 'length');
      this.emit('change');
      return this;
    },

    remove: function(item) {
      items.splice(items.indexOf(item), 1);
      this.emit('remove');
      this.emit('change', 'length');
      this.emit('change');
      return this;
    },

    each: function(cb) {
      for(var i in items) {
        cb(items[i]);
      }
      return this;
    },

    length: function() {
      return items.length;
    },

    clone: function() {
      var copy = Collection(model);
      this.each(function(item) {
        copy.add(item);
      });
      return copy;
    }
  });
};


var Query = function(model, query) {
  var items = Collection(model);
  return {};
};


module.exports = Collection;
