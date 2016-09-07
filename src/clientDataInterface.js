var _ = require('./utils.js');
var ClientStore = require('./clientStore.js');


var ClientDataInterface = function(model) {
  var localStore = ClientStore(model.name);
  var url = model.url();
  var cache = {};
  
  // Fetch object from cache
  // or create first local representation otherwise
  var init = function(data) {
    // if(cache[data._id]) return cache[data._id];
    var inst = model.create();
    inst.id = data._id;
    inst.data.remote = data;
    cache[inst.id] = inst;
    // Update local storage on all network updates
    inst.on('fetch', function() {
      localStore.set(inst);
    });
    inst.connect();
    return inst;
  };

  return {
    all: function(options, cb) {
      // Build incomplete results from local storage
      var datas = localStore.query(options.query || {}, options.limit);
      var instances = _.map(datas, function(data) {
        return cache[data._id] ? cache[data._id] : init(data);
      });
      // Use callback to return complete results from server
      _.ajax({url: url, data: options}).then(function(data) {
        cb(null, _.map(data, function(item) {
          if(cache[item._id]) {
            return cache[item._id];
          } else {
            var inst = init(item);
            // Store local copy on first fetch
            localStore.set(inst);
            return inst;
          }
        }));
      }).catch(function() {
        // Gracefully return incomplete results when network fails
        cb(null, instances);
        // cb('error', null);
      });
      // Return incomplete results synchronously
      return instances;
    },

    one: function(id, cb, raw) {
      var ajax = function(cbb) {
        _.ajax({url: url + '/' + id}).then(function(data) {
          cbb(data);
        }).catch(function() {
          cb('error', null);
        });
      };
      if(raw) {
        // Don't initialize instance and bypass cache in raw mode
        ajax(function(data) {
          cb(null, data);
        });
      } else {
        // Return live instance from cache if possible
        if(cache[id]) return cb(null, cache[id]);
        // Try to fetch object from local storage
        var data = localStore.get(id);
        if(data) {
          var inst = init(data);
          cb(null, inst);
          // Update instance from server anyways
          inst.fetch();
        } else {
          // Resort to ajax
          ajax(function(data) {
            var inst = init(data);
            // Store local copy on first fetch
            localStore.set(inst);
            cb(null, inst);
          });
        }
      }
    },

    create: function(inst, cb) {
      cache[inst.localId] = inst;
      // Save to local storage immediately in pending state
      localStore.set(inst, {_pending: 'create'});
      // Try to persist to server
      _.ajax({verb: 'POST', url: url, data: inst.serialize()}).then(function(data) {
        // Remove local storage entry under old ID
        localStore.delete(inst.localId);
        // Save again with final ID from server
        inst.id = data._id;
        cb(null, data);
        // inst.data.remote = data;
        localStore.set(inst);
      }).catch(function() {
        cb(null, inst.serialize());
      });
    },

    update: function(id, values, cb) {
      var inst = cache[id];
      // Save to local storage immediately in pending state
      localStore.set(inst, {_pending: 'update', _pendingValues: values});
      _.ajax({verb: 'POST', url: url + '/' + id, data: values}).then(function(updatedValues) {
        cb(null, updatedValues);
        localStore.set(inst, {_pending: null, _pendingValues: null});
      }).catch(function() {
        cb(null, values);
      });
    },

    delete: function(id, cb) {
      var inst = cache[id];
      if(inst) {
        // Mark object as collectable in case we're offline
        localStore.set(inst, {_pending: 'delete'});
        delete cache[id];
        _.ajax({verb: 'DELETE', url: url + '/' + id}).then(function() {
          // Remove on acknowlede
          localStore.delete(id);
        });
      }
      cb && cb();
    }
  };
};


module.exports = ClientDataInterface;



// var ClientDataInterface = function(model) {
//   var url = model.url();
//   var cache = {};
//   // Fetch object from cache
//   // or create first local representation otherwise
//   var init = function(data) {
//     if(cache[data._id]) return cache[data._id];
//     var inst = model.create();
//     inst.id = data._id;
//     inst.data.remote = data;
//     cache[inst.id] = inst;
//     return inst;
//   };
//   return {
//     all: function(options, cb) {
//       $.get(url)
//       .done(function(data) {
//         cb(null, _.map(data, function(item) {
//           return init(item);
//         }));
//       })
//       .fail(function() {
//         cb('error', null);
//       });
//     },

//     one: function(id, cb) {
//       $.get(url + '/' + id)
//       .done(function(data) {
//         cb(null, init(data));
//       })
//       .fail(function() {
//         cb('error', null);
//       });
//     },

//     create: function(inst, cb) {
//       $.post(url, {data: JSON.stringify(inst.serialize())})
//       .done(function(data) {
//         cache[data._id] = inst;
//         cb(null, data);
//       })
//       .fail(function() {
//         cb('error', null);
//       });
//     },

//     update: function(id, values, cb) {
//       $.post(url + '/' + id, {data: JSON.stringify(values)})
//       .done(function(data) {
//         cb(null, data);
//       })
//       .fail(function() {
//         cb('error', null);
//       });
//     },

//     delete: function(id, cb) {
//       delete cache[id];
//       $.ajax({url: url + '/' + id, type: 'DELETE'})
//       .always(function() {
//         cb && cb();
//       });
//     }
//   };
// };
