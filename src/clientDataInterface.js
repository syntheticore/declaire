var $ = require('jquery');
var Utils = require('./utils.js');


var ClientDataInterface = function(name) {
  var url = '/api/' + name;
  return {
    all: function(options, cb) {
      $.get(url)
      .done(function(data) {
        cb(null, data);
      })
      .fail(function() {
        cb('error', null);
      });
    },

    one: function(id, cb) {
      $.get(url + '/' + id)
      .done(function(data) {
        cb(null, data);
      })
      .fail(function() {
        cb('error', null);
      });
    },

    create: function(values, cb) {
      $.post(url, {data: JSON.stringify(values)})
      .done(function(data) {
        cb(null, data);
      })
      .fail(function() {
        cb('error', null);
      });
    },

    update: function(id, values, cb) {
      $.post(url + '/' + id, {data: JSON.stringify(values)})
      .done(function(data) {
        cb(null, data);
      })
      .fail(function() {
        cb('error', null);
      });
    },

    delete: function(id, cb) {
      $.ajax({url: url + '/' + id, type: 'DELETE'})
      .always(function() {
        cb && cb();
      });
    }
  };
};


module.exports = ClientDataInterface;
