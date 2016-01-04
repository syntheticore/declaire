var _ = require('./utils.js');

var REST = function(name, express, dataInterface) {
  var baseUrl = '/api/' + name;
  return {
    serveResource: function() {
      var self = this;
      console.log("Serving resource " + baseUrl);

      // Get all items
      express.get(baseUrl, function(req, res) {
        // Remove anti-cache marker
        delete req.query._;
        var options = JSON.parse(req.query.data);
        dataInterface.all(options, function(err, items) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(_.invoke(items, 'serialize'));
          }
        });
      });

      // Get one item
      express.get(baseUrl + '/:id', function(req, res) {
        dataInterface.one(req.params.id, function(err, item) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(item.serialize());
          }
        });
      });

      // Create item
      express.post(baseUrl, function(req, res) {
        dataInterface.create({serialize: function() { return req.body }}, function(err, item) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(item.serialize());
          }
        });
      });

      // Update item
      express.post(baseUrl + '/:id', function(req, res) {
        dataInterface.update(req.params.id, req.body, function(err, updatedValues) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(updatedValues);
          }
        });
      });

      // Delete item
      express.delete(baseUrl + '/:id', function(req, res) {
        dataInterface.delete(req.params.id, function(err) {
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


module.exports = REST;
