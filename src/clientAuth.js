var _ = require('./utils.js');

module.exports = {
  // Return a promise that resolves to a user ID
  // if authorization was successful
  login: function(username, pw) {
    return _.ajax({
      verb: 'POST',
      url: '/login',
      data: {
        username: username,
        password: pw
      }
    }).then(function(id) {
      document.cookie = 'user=' + id;
      return id;
    });
  },

  // Register a new user on the server
  signup: function(username, pw) {
    return _.ajax({
      verb: 'POST',
      url: '/signup',
      data: {
        username: username,
        password: pw
      }
    }).then(function(id) {
      document.cookie = 'user=' + id;
      return id;
    });
  },

  logout: function() {
    clearCookie();
    return _.ajax({
      verb: 'POST',
      url: '/logout'
    });
  },

  // Return the ID of the current user
  getUserId: function() {
    return document && document.cookie.replace(/(?:(?:^|.*;\s*)user\s*\=\s*([^;]*).*$)|^.*$/, "$1");
  }
};

var clearCookie = function() {
  document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
};
