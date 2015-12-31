var rsvp = require('rsvp');
var _ = require('eakwell');

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

// Return a mapping from path params to url arguments
_.extractUrlParams = function(url, path) {
  var pathSegments = path.slice(1).split('/');
  var urlSegments = url.slice(1).split('/');
  if(_.select(pathSegments, function(s) { return s != '*' }).length > urlSegments.length) return false;
  var match = true;
  var params = {};
  _.zip(pathSegments, urlSegments, function(pathSeg, urlSeg) {
    if(!match) return;
    if(pathSeg[0] == ':') {
      params[pathSeg.slice(1)] = urlSeg;
    } else {
      if(pathSeg == '*') {
        return true;
      }
      if(pathSeg != urlSeg) {
        match = false;
      }
    }
  });
  return match && params;
};

module.exports = _;
