var _ = require('underscore');

// A hierarchical structure for the lookup of keys that act like
// local variables in a programming language
var Scope = function() {
  var layers = [];

  return {
    // Add layer on top
    addLayer: function(obj) {
      layers.push(obj);
      return this;
    },

    // Return value from the topmost layer that has the given key
    get: function(key) { //XXX can be replaced by resolvePath
      for(var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];
        if(layer.model) {
          var val = layer.get(key);
          if(val != undefined) {
            return val;
          }
        } else if(layer[key] != undefined) {
          return layer[key];
        }
      }
    },

    // Return the topmost layer that has the given key
    getFirstRespondent: function(key) {
      for(var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];
        if(layer[key] != undefined || (layer.model && layer.get(key) != undefined)) {
          return layer;
        }
      }
    },

    // Look up values by a deep path
    // Also returns a reference to the found value,
    // so that updated values can be requested at a later time
    resolvePath: function(path) {
      var self = this;
      var segments = path.split('.');
      // Do the first lookup through the actual scope
      var firstSegment = segments.shift();
      var lastObj = self.getFirstRespondent(firstSegment);
      var obj = self.readAttribute(lastObj, firstSegment);
      // Then follow the regular object structure
      _.each(segments, function(segment) {
        lastObj = obj;
        obj = self.readAttribute(obj, segment);
      });
      var lastSegment = segments.pop() || firstSegment;
      var ref = {obj: lastObj, key: lastSegment};
      return {value: obj, ref: ref};
    },

    // Resolve path segment by using getter or direct property access
    // Functions are called immediately
    readAttribute: function(obj, seg) {
      if(!obj) throw('Path not found: ' + seg);
      if(obj.model) {
        return obj.get(seg);
      } else {
        if(typeof obj[seg] == 'function') {
          return obj[seg]();
        } else {
          return obj[seg];
        }
      }
    },

    // Create a copy of the stack that can be added to independently
    clone: function() {
      var copy = Scope();
      for(var i in layers) {
        copy.addLayer(layers[i]);
      }
      return copy;
    }
  }
};


module.exports = Scope;
