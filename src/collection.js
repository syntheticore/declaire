var _ = require('./utils.js');
var eventMethods = require('./events.js');


var Collection = function(array) {
  var col = _.merge(eventMethods(), {
    klass: 'Collection',
    items: [],

    // Add one or many items
    add: function(item) {
      var self = this;
      var items = Array.isArray(item) ? item : [item];
      _.each(items, function(item) {
        self.items.push(item);
        if(item && item.klass == 'Instance') {
          item.once('delete', function() {
            self.remove(item);
          });
        };
      });
      self.emit('add');
      self.emit('change', 'size');
      self.emit('change');
      return self;
    },

    // Remove a given element
    remove: function(item) {
      return this.removeAt(this.items.indexOf(item));
    },

    // Remove the element at the given index
    removeAt: function(index) {
      this.items.splice(index, 1);
      this.emit('remove');
      this.emit('change', 'size');
      this.emit('change');
      return this;
    },

    // Return the element at the given index
    at: function(index) {
      return this.items[index];
    },

    each: function(cb) {
      _.each(this.items, cb);
      return this;
    },

    map: function(cb) {
      return Collection(_.map(this.items, cb));
    },

    size: function() {
      return this.items.length;
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
      return Collection(this.items);
    },

    filter: function(query) {
      return Query(this, query);
    }
  });

  if(array) col.add(array);
  return col;
};


module.exports = Collection;
