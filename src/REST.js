var REST = function(name, express, dataInterface) {
  var baseUrl = '/api/' + name;
  return {
    serveResource: function() {
      var self = this;
      console.log("Serving resource " + baseUrl);

      // Get all items
      express.get(baseUrl, function(req, res) {
        var from = parseInt(req.query.queryFrom) || 0;
        var limit = parseInt(req.query.queryLimit) || 0;
        delete req.query._;
        delete req.query.queryFrom;
        delete req.query.queryLimit;
        dataInterface.all({query: req.query, from: from, limit: limit}, function(err, items) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(items);
          }
        });
      });

      // Get one item
      express.get(baseUrl + '/:id', function(req, res) {
        dataInterface.one(req.params.id, function(err, item) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(item);
          }
        });
      });

      // Create item
      express.post(baseUrl, function(req, res) {
        var data = JSON.parse(req.body.data);
        dataInterface.create(data, function(err, item) {
          if(err) {
            res.send(404, err);
          } else {
            res.json(item);
          }
        });
      });

      // Update item
      express.post(baseUrl + '/:id', function(req, res) {
        var data = JSON.parse(req.body.data);
        dataInterface.update(req.params.id, data, function(err, updatedValues) {
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