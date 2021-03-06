var _ = require('./utils.js');


// A hierarchical structure for the lookup of keys that act like
// local variables in a programming language
var Scope = function() {
  var layers = [];

  return {
    layers: layers,
    
    // Add layer on top
    addLayer: function(obj) {
      layers.push(obj || {});
      return this;
    },

    getTopLayer: function() {
      return _.last(layers);
    },

    // Return the topmost layer that has the given key
    getFirstRespondent: function(key) {
      for(var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];
        if(layer[key] !== undefined || (layer.model && layer.get(key) !== undefined)) {
          return layer;
        }
      }
    },

    // Look up values by a deep path
    // Also returns a reference to the found value,
    // so that updated values can be requested at a later time
    resolvePath: function(path, args) {
      var self = this;
      // Cut away the arguments part
      // These are supplied by the evaluator already
      path = path.split('(')[0];
      var segments = path.split('.');
      // Do the first lookup through the actual scope
      var firstSegment = segments.shift();
      var lastObj = self.getFirstRespondent(firstSegment);
      var lastInstance = lastObj;
      var lastInstanceKey = firstSegment;
      var objP;
      // If arguments are supplied, they are meant for
      // the final method call
      if(segments.length == 0 && args) {
        objP = _.promiseFrom(self.readAttribute(lastObj, firstSegment, args));
      } else {
        objP = _.promiseFrom(self.readAttribute(lastObj, firstSegment));
      }
      // Then follow the regular object structure
      _.each(segments, function(segment, i) {
        objP = objP.then(function(obj) {
          if(!obj) return;
          lastObj = obj;
          if(lastObj.once && lastObj.on) {
            lastInstance = lastObj;
            lastInstanceKey = segment;
          }
          if(i == segments.length - 1) {
            return _.promiseFrom(self.readAttribute(obj, segment, args));
          } else {
            return _.promiseFrom(self.readAttribute(obj, segment));
          }
        });
      });
      return objP.then(function(obj) {
        // var lastSegment = (_.hasValue(obj) && segments.pop()) || firstSegment;
        var lastSegment = segments.pop() || firstSegment;
        var ref = {
          obj: lastObj,
          key: lastSegment,
          lastInstance: lastInstance,
          lastInstanceKey: lastInstanceKey
        };
        return {value: obj, ref: ref};
      });
    },

    // Resolve path segment by using getter or direct property access
    // Functions are called immediately
    readAttribute: function(obj, seg, args) {
      if(!obj) return null;
      if(obj.klass == 'Instance') {
        if(args) {
          // Call model method
          return obj[seg].apply(obj, args);
        } else {
          // Return property or computed property
          return obj.resolve().then(function() {
            return obj.get(seg);
          });
        }
      } else {
        if(typeof obj[seg] == 'function') {
          // Call regular function
          // return obj[seg]();
          return obj[seg].apply(obj, args);
        } else {
          // Return regular attribute
          return obj[seg];
        }
      }
    },

    // Create a copy of the stack that can be added to independently
    clone: function() {
      var copy = Scope();
      _.each(layers, function(layer) {
        copy.addLayer(layer);
      });
      return copy;
    }
  }
};


module.exports = Scope;
