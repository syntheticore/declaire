var should = require('chai').should();
var Utils = require('../src/utils.js');


describe('#all', function() {
  it('returns true if all conditions hold', function() {
    Utils.all([1, 2, 3], function(n) {
      return n > 0;
    }).should.equal(true);
  });

  it('returns false if any conditions fails', function() {
    Utils.all([-1, 2, -3], function(n) {
      return n < 0;
    }).should.equal(false);
  });
});

describe('#zip', function() {
  it('returns as many pairs as the shorter list has items', function() {
    var count = 0;
    Utils.zip([1, 3], [2, 4, 5], function(n1, n2) {
      count++;
    });
    count.should.equal(2);
  });

  it('returns as many pairs as the shorter list has items', function() {
    var count = 0;
    Utils.zip([1, 3, 5], [2, 4], function(n1, n2) {
      count++;
    });
    count.should.equal(2);
  });

  it('returns a flat list', function() {
    Utils.zip([1, 3], [2, 4]).should.equal([1, 2, 3, 4]);
  });
});
