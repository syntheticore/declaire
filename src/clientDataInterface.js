var $ = require('jquery');
var Utils = require('./utils.js');


var ClientDataInterface = function(name) {
  var url = '/api/' + name;
  return {
    all: function(options, cb) {
      $.get(url)
      .done(function(data) {
        // console.log(data);
        cb(null, data);
      })
      .fail(function(err) {
        console.log('fail');
        cb(err, null);
      });
    },

    one: function(id, cb) {
      $.get(url + '/' + id)
      .done(function(data) {
        cb(null, data);
      })
      .fail(function(err) {
        cb(err, null);
      });
    },

    create: function(values, cb) {
      $.post(url, {data: JSON.stringify(values)})
      .done(function(data) {
        cb(null, data);
      })
      .fail(function(err) {
        cb(err, null);
      });
    },

    update: function(id, values, cb) {
      $.post(url + '/' + id, {data: JSON.stringify(values)})
      .done(function(data) {
        cb(null, data);
      })
      .fail(function(err) {
        cb(err, null);
      });
    },

    delete: function(id, cb) {
      $.ajax({url: url + '/' + id, type: 'DELETE'})
      .always(function(err) {
        cb && cb();
      });
    }
  };
};


module.exports = ClientDataInterface;
