var _ = require('./utils.js');
var eventMethods = require('./events.js');


var Collection = function(array) {
  var items = [];

  var col = _.merge(eventMethods(), {
    klass: 'Collection',

    // Add one or many items
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

    // Remove a given element
    remove: function(item) {
      return this.removeAt(items.indexOf(item));
    },

    // Remove the element at the given index
    removeAt: function(index) {
      items.splice(index, 1);
      this.emit('remove');
      this.emit('change', 'length');
      this.emit('change');
      return this;
    },

    // Return the element at the given index
    at: function(index) {
      return items[index];
    },

    each: function(cb) {
      _.each(items, cb);
      return this;
    },

    map: function(cb) {
      return Collection(_.map(items, cb));
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

    // Replace contained model references with full model instances
    resolve: function(cb) {
      cb();
    },

    clone: function() {
      return Collection(items);
    },

    filter: function(query) {
      return Query(this, query);
    }
  });

  if(array) col.add(array);
  return col;
};


module.exports = Collection;
