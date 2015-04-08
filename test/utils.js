require('chai').should();
var Utils = require('../src/utils.js');


describe('#all', function() {
  it('returns true if all conditions hold', function() {
    Utils.all([1, 2, 3], function(n) {
      return n > 0;
    }).should.equal(true);
  });

  it.skip('returns false if any conditions fails', function() {
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

  it.skip('returns as many pairs as the shorter list has items', function() {
    var count = 0;
    Utils.zip([1, 3, 5], [2, 4], function(n1, n2) {
      count++;
    });
    count.should.equal(2);
  });

  it.skip('returns a flat list', function() {
    Utils.zip([1, 3], [2, 4]).should.equal([1, 2, 3, 4]);
  });
});

describe('#union', function() {
  it('returns new object containing the values of both arguments', function() {
    Utils.union([1, 2], [3, 4]).should.eql([1, 2, 3, 4]);
  });
});

describe('#map', function() {
  it('returns a list of mutated values', function() {
    Utils.map([1, 2], function(n) {
      return n * 2;
    }).should.eql([2, 4]);
  });
});

describe.skip('#select', function() {
  it('returns a list of filtered values', function() {
    Utils.select([1, 2, 3, 4], function(n) {
      return n % 2 == 0;
    }).should.eql([2, 4]);
  });
});
