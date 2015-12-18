require('chai').should();
var Collection = require('../src/collection.js');

describe('Collection', function() {
  describe('#add()', function() {
    it('emits a change event when an item is added', function(done) {
      var c = Collection();
      c.on('change', function() {
        done();
      });
      c.add(1);
    });

    it('contains the added item', function() {
      var c = Collection();
      c.add(1);
      c.at(0).should.equal(1);
    });

    it('reports its length correctly', function() {
      var c = Collection();
      c.size().should.equal(0);
      c.add(1);
      c.size().should.equal(1);
      c.add(3);
      c.size().should.equal(2);
      c.remove(1);
      c.size().should.equal(1);
    });

    it('reports its new length when an item is added', function(done) {
      var c = Collection();
      c.on('change:size', function() {
        c.size().should.equal(1);
        done();
      });
      c.add(null);
    });
  });
});
