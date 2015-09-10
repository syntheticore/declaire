// "use strict";
var RSVP = require('rsvp');


// Check if we are executing on the server
//XXX Would browserify minifier optimize this away if it wasn't a function?
exports.onServer = function(cb) {
  var server = (typeof(window) == 'undefined');
  // var server = !process.env.browser;
  if(server && cb) cb(server);
  return server;
};

// Check if we are executing in the browser
exports.onClient = function(cb) {
  var client = !exports.onServer();
  if(client && cb) cb(client);
  return client;
};

// Loop through objects and arrays
// Return something truthy from callback to stop iteration
exports.each = function(items, cb) {
  for(var key in items) {
    var cancel = cb(items[key], key);
    if(cancel) return cancel;
  }
};

// Return a copy the given array
// with each item replaced according to <cbOrName>
exports.map = function(items, cbOrName) {
  var callback = (typeof cbOrName === 'function');
  var out = Array.isArray(items) ? [] : {};
  exports.each(items, function(item, key) {
    out[key] = (callback ? cbOrName(item, key) : item[cbOrName]);
  });
  return out;
};

// Call the given function <n> times
exports.times = function(n, cb) {
  for(var i = 0; i < n; i++) {
    cb(i);
  }
};

// Invoke the named method on each item
// Additional arguments will be passed to the invoked methods
exports.invoke = function(items, key) {
  var out = [];
  var args = Array.prototype.slice.call(arguments).splice(2);
  exports.each(items, function(item) {
    out.push(item[key].apply(item, args));
  });
  return out;
};

// Interleave the items of two arrays
exports.zip = function(items1, items2, cb) {
   var out = [];
  exports.each(items1, function(item1, i) {
    var item2 = items2[i];
    if(item2 == undefined) return true;
    out.push([item1, item2]);
    cb && cb(item1, item2);
  });
  return out;
};

// Make a flat array from a hierarchy of nested arrays
exports.flatten = function(items) {
  var out = [];
  exports.each(items, function(item) {
    if(Array.isArray(item)) {
      var flat = exports.flatten(item);
      out.push.apply(out, flat);
    } else {
      out.push(item);
    }
  });
  return out;
};

// Select items fron an array or object that match the given condition
exports.select = function(items, cb, n) {
  var ary = Array.isArray(items);
  var out = ary ? [] : {};
  var i = 0;
  exports.each(items, function(item, key) {
    if(cb(item, key)) {
      if(ary) {
        out.push(item);
      } else {
        out[key] = item;
      }
    }
    if(n && ++i == n) return true;
  });
  return out;
};

// Check if all items match the given condition
exports.all = function(items, cb) {
  return exports.select(items, cb).length == items.length;
};

// Check if any item matches the given condition
exports.any = function(items, cb) {
  return exports.each(items, function(item, key) {
    if(cb(item, key)) {
      return true;
    }
  })
};

// Return the last element of the given array or string
exports.last = function(items) {
  return items[items.length - 1];
};

// Check if <item> is a member of the array, object or string
// Return the key where <item> was found if <items> is an object
exports.contains = function(items, item) {
  // For arrays and strings
  if(items.indexOf) {
    return items.indexOf(item) != -1;
  // For objects
  } else {
    return exports.each(items, function(value, key) {
      if(value === item) {
        return key;
      }
    });
  }
 };

// Merge two arrays
exports.union = function(items1, items2) {
  var out = [];
  exports.each(items1, function(item) {
    out.push(item);
  });
  exports.each(items2, function(item) {
    out.push(item);
  });
  return out;
};

// Shallow copy the given array
exports.clone = function(items) {
  return exports.union(items, []);
};

// Return the given object's keys
exports.keys = function(obj) {
  return Object.keys(obj);
};

// Return the given object's values as an array
exports.values = function(obj) {
  var out = [];
  for(var key in obj) {
    if(obj.hasOwnProperty(key)) {
      out.push(obj[key]);
    }
  }
  return out;
};

// Return new object with the fields from both given objects
exports.merge = function(obj1, obj2) {
  var obj = {};
  for(var i in obj1) {
    obj[i] = obj1[i];
  }
  for(var i in obj2) {
    obj[i] = obj2[i];
  }
  return obj;
};

exports.compact = function(items) {
  return exports.select(items, function(item) {
    return item != null && item != undefined;
  });
};

// Recursively merge two data structures
exports.deepMerge = function(obj1, obj2) {
  return exports.merge(obj1, obj2);
};

// Convert the given strings first character to upperspace
exports.capitalize = function(str) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
};

// Execute function at a later time
exports.defer = function(cb, millis) {
  return setTimeout(cb, millis || 0);
};

// Return a Promises/A+ compliant promise object
exports.promise = function(cb) {
  return new RSVP.Promise(cb);
};

// Wrap a value with a promise
exports.promiseFrom = function(value) {
  return exports.promise(function(ok) {
    exports.defer(function() {
      ok(value);
    });
  });
};

// Resolve all values in items
exports.resolvePromises = function(items) {
  var wrapped = exports.map(items, function(item) {
    return exports.promiseFrom(item);
  });
  if(Array.isArray(items)) {
    return RSVP.all(wrapped);
  } else {
    return RSVP.hash(wrapped);
  }
};

// Return a wrapper function that calls <cb>,
// but at most every <thresh> milliseconds
exports.throttle = function(thresh, cb) {
  thresh = thresh || 1000;
  var lastT;
  var handle;
  return function() {
    var t = new Date().getMilliseconds();
    if(!lastT) {
      cb();
      lastT = t;
    } else {
      if(!handle) {
        var delta = t - lastT;
        var sleep = Math.max(0, thresh - delta);
        handle = exports.defer(function() {
          cb();
          lastT = t;
          handle = null;
        }, sleep);
      }
    }
  };
};

// Empty placeholder function
exports.noop = function() {};

// Return a mapping from path params to url arguments
exports.extractUrlParams = function(url, path) {
  var pathSegments = path.slice(1).split('/');
  var urlSegments = url.slice(1).split('/');
  if(pathSegments.length != urlSegments.length) return false;
  var match = true;
  var params = {};
  exports.zip(pathSegments, urlSegments, function(pathSeg, urlSeg) {
    if(!match) return;
    if(pathSeg[0] == ':') {
      params[pathSeg.slice(1)] = urlSeg;
    } else {
      if(pathSeg != urlSeg) {
        match = false;
      }
    }
  });
  return match && params;
};

// Return all matches of the given regex
exports.scan = function(str, re) {
  var matches = [];
  var m;
  while(m = re.exec(str)) {
    matches.push(m);
  }
  return matches;
};

// Return a universally unique id
exports.uuid = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

// Execute the given function, while modifying raised exceptions to
// point to the parsed Template, instead of the library code
var $debug = true;
exports.improveExceptions = function(filename, cb) {
  if($debug) {
    return cb();
  } else {
    try {
      return cb();
    } catch(e) {
      // throw('Error: ' + filename + ':' + e.lineNum + ': ' + e.message);
      console.log("Error in " + exports.last(filename.split('/')) + ":" + e.lineNum + ": " + e.message);
      throw e;
    }
  }
};
