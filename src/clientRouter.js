var _ = require('./utils.js');


var Router = function() {
  var listeners = {};
  var suppressNextPopstate = false;

  var scrollTo = function(id) {
    window.scrollTo(0, document.getElementById(id).offsetTop);
  };

  var self = {
    on: function(path, cb) {
      listeners[path] = cb;
    },

    // Push url to the stack and and trigger popstate event
    navigate: function(url) {
      history.pushState({}, '', url);
      window.onpopstate();
      // Try to scroll to anchor after page has changed
      var id = window.location.hash.slice(1);
      _.defer(function() {
        if(id) scrollTo(id);
      }, 200);
    },

    // Prevent page internal links from reloading the page
    hijackLocalLinks: function() {
      var self = this;
      // Register event once and for all on the body
      _.delegate(document.body, 'click', 'a', function(e) {
        var href = e.target.getAttribute('href');
        // Internal links
        if(href.slice(0, 1) == '/' && href.slice(1, 2) != '/') {
          e.preventDefault();
          // Navigate locally unless target url is the same
          if(window.location.pathname + window.location.hash != href) self.navigate(href);
          return false;
        // Simple anchors
        } else if(href.slice(0, 1) == '#') {
          // Use browsers default behaviour of scrolling
          // to referenced ID, but keep the view from updating otherwise
          suppressNextPopstate = true;
        }
        // Full load of external link otherwise
      });
    }
  };

  window.onpopstate = function(event) {
    // var state = event.state;
    if(suppressNextPopstate) {
      suppressNextPopstate = false;
      return;
    }
    var url = document.location.pathname;
    // Extract url params and call listeners
    _.each(listeners, function(listener, path) {
      var params = _.values(_.extractUrlParams(url, path));
      if(params || path == '*') {
        listener.apply(null, params);
      }
    });
  };

  return self;
};


module.exports = Router;
