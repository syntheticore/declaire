var Utils = require('./utils.js');
var eventMethods = require('./events.js');


var Collection = function(array) {
  var items = array || [];

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

    at: function(index) {
      return items[index];
    },

    each: function(cb) {
      for(var i in items) {
        cb(items[i], i);
      }
      return this;
    },

    map: function(cb) {
      var out = [];
      this.each(function(item, i) {
        out.push(cb(item, i));
      });
      return Collection(out);
    },

    values: function() {
      return items;
    },

    length: function() {
      return items.length;
    },

    filter: function(query) {
      return Query(this, query);
    },

    // Return a simple array of all values,
    // but collapse contained model instances to serializable references
    serialize: function() {
      var out = [];
      this.each(function(item) {
        if(item.klass == 'Model') {
          out.push()
        } else {

        }
      });
      return out;
    },

    unserialize: function(index) {

    },

    clone: function() {
      return this.map(function(item) { return item; });
    }
  });
};


var Query = function(collectionOrUrl, query) {
  var items = Collection(model);
  return {};
};


var Reference = function(model, id) {
  return {
    resolve: function(cb) {
      model.load(id, cb);
    }
  };
};


module.exports = Collection;
