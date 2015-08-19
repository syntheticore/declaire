var _ = require('./utils.js');
var eventMethods = require('./events.js');


var Collection = function(array) {
  var items = [];

  var col = _.merge(eventMethods, {
    klass: 'Collection',
    // listeners: [],

    add: function(item) {
      var self = this;
      var itms = Array.isArray(item) ? item : [item];
      _.each(itms, function(item) {
        items.push(item);
        if(item && item.klass == 'Instance') {
          item.once('delete', function() {
            self.remove(item);
          });
        };
      });
      self.emit('add');
      self.emit('change', 'length');
      self.emit('change');
      return self;
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

    // Return a simple array of all values,
    // but collapse contained model instances to serializable references
    serialize: function() {
      var out = [];
      this.each(function(item) {
        if(item.klass == 'Instance') {
          var ref = item.reference();
          if(ref) {
            out.push(ref);
          }
        } else {
          out.push(item);
        }
      });
      return out;
    },

    unserialize: function(index) {

    },

    clone: function() {
      return this.map(function(item) { return item });
    },

    filter: function(query) {
      return Query(this, query);
    }
  });

  col.add(array);
  return col;
};


module.exports = Collection;
