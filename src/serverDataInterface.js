var mongo = require('mongodb');
var Utils = require('./utils.js');


var ServerDataInterface = function(app, name) {
  return {
    all: function(options, cb) {
      options = Utils.merge({
        query: {},
        from: 0,
        limit: 0
      }, options);
      app.db.collection(name).find(options.query, {image:0, salt:0, hash:0}).skip(options.from).limit(options.limit).toArray(function(err, items) {
        cb(err, items);
      });
      return this;
    },

    one: function(id, cb) {
      app.db.collection(name).findOne({_id: new mongo.ObjectID(id)}, {image:0, salt:0, hash:0}, function(err, item) {
        console.log("one error " + item);
        if(!item) {
          cb("Object with id '" + id + "' could not be found in the collection '" + name + "'", null);
        } else {
          cb(err, item);
        }
      });
    },

    create: function(values, cb) {
      var fields = Utils.merge(values, {createdAt: new Date(), updatedAt: new Date()});
      app.db.collection(name).insert(fields, function(err, items) {
        var item = items[0];
        if(!err) app.pubSub.publish({type: 'create', collection: name, id: item._id, data: item});
        cb(err, item);
      });
      return this;
    },

    update: function(id, values, cb) {
      values = Utils.merge({}, values);
      delete values._id;
      delete values.createdAt;
      values.updatedAt = new Date();
      app.db.collection(name).update({_id: new mongo.ObjectID(id)}, {$set: values}, function(err) {
        if(err) {
          cb(err);
        } else {
          app.pubSub.publish({type: 'update', collection: name, id: id, data: values});
          cb(null, {updatedAt: values.updatedAt});
        }
      });
    },

    delete: function(id, cb) {
      app.db.collection(name).remove({_id: new mongo.ObjectID(id)}, function(err) {
        if(!err) app.pubSub.publish({type: 'delete', collection: name, id: id});
        cb(err);
      });
    }
  };
};


module.exports = ServerDataInterface;
