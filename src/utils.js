// "use strict";
var RSVP = require('rsvp');

var _ = {};

// Empty placeholder function
_.noop = function() {};

// Check if we are executing on the server
//XXX Would browserify minifier optimize this away if it wasn't a function?
_.onServer = function(cb) {
  var server = (typeof(window) == 'undefined');
  // var server = !process.env.browser;
  if(server && cb) cb(server);
  return server;
};

// Check if we are executing in the browser
_.onClient = function(cb) {
  var client = !_.onServer();
  if(client && cb) cb(client);
  return client;
};

// Loop through objects and arrays
// Return something truthy from callback to stop iteration
_.each = function(items, cb) {
  for(var key in items) {
    var cancel = cb(items[key], key);
    if(cancel) return cancel;
  }
};

// Return a copy the given array
// with each item replaced according to <cbOrName>
_.map = function(items, cbOrName) {
  var callback = (typeof cbOrName === 'function');
  var out = Array.isArray(items) ? [] : {};
  _.each(items, function(item, key) {
    out[key] = (callback ? cbOrName(item, key) : item[cbOrName]);
  });
  return out;
};

// Call the given function <n> times
_.times = function(n, cb) {
  for(var i = 0; i < n; i++) {
    cb(i);
  }
};

// Invoke the named method on each item
// Additional arguments will be passed to the invoked methods
_.invoke = function(items, key) {
  var out = [];
  var args = Array.prototype.slice.call(arguments).splice(2);
  _.each(items, function(item) {
    out.push(item[key].apply(item, args));
  });
  return out;
};

// Interleave the items of two arrays
_.zip = function(items1, items2, cb) {
   var out = [];
  _.each(items1, function(item1, i) {
    var item2 = items2[i];
    if(item2 == undefined) return true;
    out.push([item1, item2]);
    cb && cb(item1, item2);
  });
  return out;
};

// Make a flat array from a hierarchy of nested arrays
_.flatten = function(items) {
  var out = [];
  _.each(items, function(item) {
    if(Array.isArray(item)) {
      var flat = _.flatten(item);
      out.push.apply(out, flat);
    } else {
      out.push(item);
    }
  });
  return out;
};

// Select items fron an array or object that match the given condition
_.select = function(items, cb, n) {
  var ary = Array.isArray(items);
  var out = ary ? [] : {};
  var i = 0;
  _.each(items, function(item, key) {
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
_.all = function(items, cb) {
  return _.select(items, cb).length == items.length;
};

// Check if any item matches the given condition
_.any = function(items, cb) {
  return _.each(items, function(item, key) {
    if(cb(item, key)) {
      return true;
    }
  }) || false;
};

// Return the last element of the given array or string
_.last = function(items) {
  return items[items.length - 1];
};

// Check if <item> is a member of the array, object or string
// Return the key where <item> was found if <items> is an object
_.contains = function(items, item) {
  // For arrays and strings
  if(items.indexOf) {
    return items.indexOf(item) != -1;
  // For objects
  } else {
    return _.each(items, function(value, key) {
      if(value === item) {
        return key;
      }
    });
  }
 };

// Merge two arrays
_.union = function(items1, items2) {
  var out = [];
  _.each(items1, function(item) {
    out.push(item);
  });
  _.each(items2, function(item) {
    out.push(item);
  });
  return out;
};

// Shallow copy the given array
_.clone = function(items) {
  return _.union(items, []);
};

// Return the given object's keys
_.keys = function(obj) {
  return Object.keys(obj);
};

// Return the given object's values as an array
_.values = function(obj) {
  var out = [];
  for(var key in obj) {
    if(obj.hasOwnProperty(key)) {
      out.push(obj[key]);
    }
  }
  return out;
};

// Return new object with the fields from both given objects
_.merge = function(obj1, obj2) {
  var obj = {};
  for(var i in obj1) {
    obj[i] = obj1[i];
  }
  for(var i in obj2) {
    obj[i] = obj2[i];
  }
  return obj;
};

// Return a copy without the null and undefined elements
_.compact = function(items) {
  return _.select(items, function(item) {
    return item != null && item != undefined;
  });
};

// Recursively merge two data structures
_.deepMerge = function(obj1, obj2) {
  return _.merge(obj1, obj2);
};

// Convert the given string's first character to uppercase
_.capitalize = function(str) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
};

// Execute function at a later time
_.defer = function(cb, millis) {
  return setTimeout(cb, millis || 0);
};

// Return a Promises/A+ compliant promise object
_.promise = function(cb) {
  return new RSVP.Promise(cb);
};

// Wrap a value with a promise
_.promiseFrom = function(value) {
  return _.promise(function(ok) {
    _.defer(function() {
      ok(value);
    });
  });
};

// Resolve all values in items
_.resolvePromises = function(items) {
  var wrapped = _.map(items, function(item) {
    return _.promiseFrom(item);
  });
  if(Array.isArray(items)) {
    return RSVP.all(wrapped);
  } else {
    return RSVP.hash(wrapped);
  }
};

// Return a wrapper function that calls <cb>,
// but at most every <thresh> milliseconds
_.throttle = function(thresh, cb) {
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
        handle = _.defer(function() {
          cb();
          lastT = t;
          handle = null;
        }, sleep);
      }
    }
  };
};

// Return a mapping from path params to url arguments
_.extractUrlParams = function(url, path) {
  var pathSegments = path.slice(1).split('/');
  var urlSegments = url.slice(1).split('/');
  if(pathSegments.length != urlSegments.length) return false;
  var match = true;
  var params = {};
  _.zip(pathSegments, urlSegments, function(pathSeg, urlSeg) {
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
_.scan = function(str, re) {
  var matches = [];
  var m;
  while(m = re.exec(str)) {
    matches.push(m);
  }
  return matches;
};

// Return a universally unique id
_.uuid = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

// Execute the given function, while modifying raised exceptions to
// point to the parsed Template, instead of the library code
var $debug = true;
_.improveExceptions = function(filename, cb) {
  if($debug) {
    return cb();
  } else {
    try {
      return cb();
    } catch(e) {
      // throw('Error: ' + filename + ':' + e.lineNum + ': ' + e.message);
      console.log("Error in " + _.last(filename.split('/')) + ":" + e.lineNum + ": " + e.message);
      throw e;
    }
  }
};

module.exports = _;
