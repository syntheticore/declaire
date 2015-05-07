// Check if we are executing on the server
//XXX Would browserify minifier optimize this away if it wasn't a function?
exports.onServer = function(cb) {
  var server = (typeof(window) == 'undefined');
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
// Return false from callback to stop iteration
exports.each = function(items, cb) {
  for(var key in items) {
    var cancel = cb(items[key], key);
    if(cancel) return;
  }
};

// Return a copy the given array
// with each item replaced according to <cb>
exports.map = function(items, cb) {
  var out = Array.isArray(items) ? [] : {};
  exports.each(items, function(item, key) {
    out[key] = cb(item, key);
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
exports.invoke = function(items, key) {
  var out = [];
  exports.each(items, function(item) {
    out.push(item[key]());
  });
  return out;
};

// Interleave the items of two arrays
exports.zip = function(items1, items2, cb) {
  exports.each(items1, function(item1, i) {
    cb(item1, items2[i]);
  });
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

exports.last = function(items) {
  return items[items.length - 1];
};

// Check if <item> is a member of the array
exports.contains = function(items, item) {
  return items.indexOf(item) != -1;
};

// Merge two array
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

exports.deepMerge = function(obj1, obj2) {
  return exports.merge(obj1, obj2);
};

// Execute function at a later time
exports.defer = function(cb, millis) {
  return setTimeout(cb, millis || 0);
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
      throw('Error: ' + filename + ':' + e.lineNum + ': ' + e.message);
    }
  }
};
