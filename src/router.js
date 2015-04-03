var Utils = require('./utils.js');


var Router = function() {
  var listeners = {};

  var matches = function(path, url) {
    var pathSegments = path.slice(1).split('/');
    var urlSegments = url.slice(1).split('/');
    if(pathSegments.length != urlSegments.length) return false;
    var match = true;
    var params = [];
    Utils.zip(pathSegments, urlSegments, function(pathSeg, urlSeg) {
      if(!match) return;
      if(pathSeg[0] == ':') {
        // var param = seg.slice(1);
        params.push(urlSeg);
      } else {
        if(pathSeg != urlSeg) {
          match = false;
        }
      }
    });
    return match && params;
  };

  window.onpopstate = function(event) {
    // var state = event.state;
    var url = document.location.pathname;
    Utils.each(listeners, function(cb, path) {
      var params = matches(path, url);
      if(params) {
        cb.apply(null, params);
      }
    });
  };

  Utils.defer(window.onpopstate);

  return {
    on: function(path, cb) {
      listeners[path] = cb;
    }
  };
};


module.exports = Router;
