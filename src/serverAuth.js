var contextService = require('request-context');
var crypto = require('crypto');
var _ = require('./utils.js');


module.exports = {
  // Return the ID of the current user
  getUserId: function() {
    return contextService.get('declaire:user');
  },

  // Implement simple username & password based authentication
  serve: function(expressApp, db) {
    expressApp.post('/login', function(req, res) {
      var users = db.collection('users');
      users.findOne({_username: req.body.username}, function(err, user) {
        if(!user || user._hash != sha256(req.body.password)) {
          res.status(401).send('Please check your username and password'); // Unauthorized
        } else {
          req.session.user = user._id;
          res.send(user._id);
        }
      });
    });

    expressApp.post('/signup', function(req, res) {
      var name = req.body.username;
      var pw = req.body.password;
      if(name.length < 2) {
        res.status(400).send('Username is too short');
        return;
      }
      if(pw.length < 4) {
        res.status(400).send('Password is too short');
        return;
      }
      var users = db.collection('users');
      users.findOne({_username: name}, function(err, user) {
        if(!user) {
          users.insert({_username: name, _hash: sha256(pw), createdAt: new Date(), updatedAt: new Date()}, function(err, insert) {
            var id = insert.ops[0]._id;
            req.session.user = id;
            res.status(201).send(id); // Created
          });
        } else {
          res.status(409).send('This account exists already'); // Conflict
        }
      });
    });

    expressApp.post('/logout', function(req, res) {
      req.session.user = null;
      res.send();
    });
  }
};

var sha256 = function(data) {
  var hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
};
