var $ = require('jquery');
var _ = require('./utils.js');


var Router = function() {
  var listeners = {};

  var self = {
    on: function(path, cb) {
      listeners[path] = cb;
    },

    navigate: function(url) {
      history.pushState({}, '', url);
      window.onpopstate();
    },

    hijackLocalLinks: function() {
      var self = this;
      $('body').on('click', 'a', function(e) {
        var href = $(this).attr('href');
        if(href.slice(0, 1) == '/' && href.slice(1, 2) != '/') {
          e.preventDefault();
          self.navigate(href);
          return false;
        }
      });
    }
  };

  window.onpopstate = function(event) {
    // var state = event.state;
    var url = document.location.pathname;
    _.each(listeners, function(listener, path) {
      var params = _.values(_.extractUrlParams(url, path));
      if(params || path == '*') {
        listener.apply(null, params);
      }
    });
  };

  // _.defer(window.onpopstate);

  return self;
};


module.exports = Router;
