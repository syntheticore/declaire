var $ = require('jquery');
var _ = require('./utils.js');


var ClientDataInterface = function(model) {
  var url = model.url();
  var cache = {};
  // Fetch object from cache
  // or create first local representation otherwise
  var init = function(data) {
    if(cache[data._id]) return cache[data._id];
    var inst = model.create();
    inst.id = data._id;
    inst.data.remote = data;
    cache[inst.id] = inst;
    return inst;
  };
  return {
    all: function(options, cb) {
      $.get(url)
      .done(function(data) {
        cb(null, _.map(data, function(item) {
          return init(item);
        }));
      })
      .fail(function() {
        cb('error', null);
      });
    },

    one: function(id, cb) {
      $.get(url + '/' + id)
      .done(function(data) {
        cb(null, init(data));
      })
      .fail(function() {
        cb('error', null);
      });
    },

    create: function(inst, cb) {
      $.post(url, {data: JSON.stringify(inst.serialize())})
      .done(function(data) {
        cache[data._id] = inst;
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
