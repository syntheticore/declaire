var mongo = require('mongodb');
var _ = require('./utils.js');


var ServerDataInterface = function(app, model) {
  var name = model.name;
  var remoteOnly = {_image: 0, _salt: 0, _hash: 0, _username: 0};

  var init = function(data) {
    var inst = model.create();
    inst.id = data._id;
    inst.data.remote = data;
    return inst;
  };

  return {
    all: function(options, cb) {
      options = _.merge({
        query: {},
        from: 0,
        limit: 0
      }, options);
      app.db.collection(name).find(options.query, remoteOnly).skip(options.from).limit(options.limit).toArray(function(err, items) {
        items = _.map(items, function(item) {
          return init(item);
        });
        cb(err, items);
      });
      return this;
    },

    one: function(id, cb) {
      app.db.collection(name).findOne({_id: new mongo.ObjectID(id)}, remoteOnly, function(err, item) {
        if(!item) {
          cb("Object with id '" + id + "' could not be found in the collection '" + name + "'", null);
        } else {
          cb(err, init(item));
        }
      });
    },

    create: function(inst, cb) {
      var fields = _.merge(inst.serialize(), {createdAt: new Date(), updatedAt: new Date()});
      //XXX Should not be neccessary
      delete fields._id;
      app.db.collection(name).insertOne(fields, function(err, res) {
        if(err) return cb(err);
        var id = res.insertedId || res.getInsertedIds()[0];
        fields._id = id;
        cb(null, fields);
        app.pubSub.publish({type: 'create', collection: name, id: fields._id, data: fields});
      });
      return this;
    },

    update: function(id, values, cb) {
      values = _.merge({}, values);
      delete values._id;
      delete values.createdAt;
      values.updatedAt = new Date();
      app.db.collection(name).updateOne({_id: new mongo.ObjectID(id)}, {$set: values}, function(err) {
        if(err) {
          cb(err);
        } else {
          cb(null, values);
          app.pubSub.publish({type: 'update', collection: name, id: id, data: values});
        }
      });
    },

    delete: function(id, cb) {
      app.db.collection(name).deleteOne({_id: new mongo.ObjectID(id)}, function(err) {
        cb(err);
        if(!err) app.pubSub.publish({type: 'delete', collection: name, id: id});
      });
    }
  };
};


module.exports = ServerDataInterface;
