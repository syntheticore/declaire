var mongo = require('mongodb');
var Utils = require('./utils.js');


var ServerDataInterface = function(name, app, db, publisher) {
  var collection = db.collection(name);
  var baseUrl = '/api/' + name;
  var publish = publisher.publish;

  return {
    all: function(options, cb) {
      options = Utils.merge({
        query: {},
        from: 0,
        limit: 0
      }, options);
      collection.find(options.query, {image:0, salt:0, hash:0}).skip(options.from).limit(options.limit).toArray(function(err, items) {
        cb(err, items);
      });
      return this;
    },

    one: function(id, cb) {
      collection.findOne({_id: new mongo.ObjectID(id)}, {image:0, salt:0, hash:0}, function(err, item) {
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
      collection.insert(fields, function(err, items) {
        var item = items[0];
        if(!err) publish({type: 'create', collection: name, id: item._id, data: item});
        cb(err, item);
      });
      return this;
    },

    update: function(id, values, cb) {
      values = Utils.merge({}, values);
      delete values._id;
      delete values.createdAt;
      values.updatedAt = new Date();
      collection.update({_id: new mongo.ObjectID(id)}, {$set: values}, function(err) {
        if(err) {
          cb(err);
        } else {
          publish({type: 'update', collection: name, id: id, data: values});
          cb(null, {updatedAt: values.updatedAt});
        }
      });
    },

    delete: function(id, cb) {
      collection.remove({_id: new mongo.ObjectID(id)}, function(err) {
        if(!err) publish({type: 'delete', collection: name, id: id});
        cb(err);
      });
    },

    serveResource: function() {
      var self = this;
      console.log("Serving resource " + baseUrl);

      // Get all items
      app.get(baseUrl, function(req, res) {
        var from = parseInt(req.query.queryFrom) || 0;
        var limit = parseInt(req.query.queryLimit) || 0;
        delete req.query._;
        delete req.query.queryFrom;
        delete req.query.queryLimit;
        self.all({query: req.query, from: from, limit: limit}, function(err, items) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(items);
          }
        });
      });

      // Get one item
      app.get(baseUrl + '/:id', function(req, res) {
        self.one(req.params.id, function(err, item) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(item);
          }
        });
      });

      // Create item
      app.post(baseUrl, function(req, res) {
        var data = JSON.parse(req.body.data);
        self.create(data, function(err, item) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(item);
          }
        });
      });

      // Update item
      app.post(baseUrl + '/:id', function(req, res) {
        var data = JSON.parse(req.body.data);
        self.update(req.params.id, data, function(err, updatedValues) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(updatedValues);
          }
        });
      });

      // Delete item
      app.delete(baseUrl + '/:id', function(req, res) {
        self.delete(req.params.id, function(err) {
          if(err) {
            res.send(404, err);
          } else {
            res.end();
          }
        });
      });

      return this;
    }
  };
};


module.exports = ServerDataInterface;
