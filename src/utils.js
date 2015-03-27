exports.onServer = function(cb) {
  var server = (typeof(window) == 'undefined');
  if(server && cb) cb(server);
  return server;
};

exports.onClient = function(cb) {
  var client = !exports.onServer();
  if(client && cb) cb(client);
  return client;
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

exports.each = function(items, cb) {
  for(var key in items) {
    cb(items[key], key);
  }
};

exports.map = function(items, cb) {
  var out = [];
  exports.each(items, function(item, key) {
    out.push(cb(item, key));
  });
  return out;
};

exports.select = function(items, cb) {
  var out = [];
  exports.each(items, function(item, key) {
    if(cb(item, key)) {
      out.push(item);
    }
  });
  return out;
};

exports.all = function(items, cb) {
  return exports.select(items, cb).length == items.length;
};

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

exports.defer = function(cb, millis) {
  setTimeout(cb, millis || 0);
};
