require('chai').should();
var Model = require('../src/model.js');

describe('Model', function() {
  var Todo;

  it('allows the definition of data models', function() {
    Todo = Model('todos', {
      title: 'Untitled',
      done: false,

      computed: function() {
        return this.get('title');
      },

      check: function() {
        this.set('done', true);
      }
    });
  });

  describe('#create()', function() {
    it('allows the creation of model instances', function() {
      Todo.create();
    });
  });

  describe.skip('#load()', function() {
    it('allows the loading of model instances', function(done) {
      var todo = Todo.load(done);
    });
  });


  describe('Instance', function() {

    describe('#get()', function() {
      it('returns default values', function() {
        var todo = Todo.create();
        todo.get('title').should.equal('Untitled');
      });

      it('returns the values passed to the constructor', function() {
        var todo = Todo.create({title: 'Foo'});
        todo.get('title').should.equal('Foo');
      });

      it('returns previously set values', function() {
        Todo.create().set({a: 'b', b: 'a'}).get('b').should.equal('a');
      });

      it.skip('saves without error', function(done) {
        Todo.create().save(done);
      });

      it('should be dirty when fresh', function() {
        Todo.create().isDirty().should.equal(true);
      });

      it.skip('emits a generic change event when a property is set', function(done) {
        var todo = Todo.create();
        todo.on('change', function() {
          todo.get('done').should.equal(true);
          done();
        });
        todo.check();
      });

      it.skip('emits a specific change event when a property is set', function(done) {
        var todo = Todo.create();
        todo.on('change:done', function() {
          todo.get('done').should.equal(true);
          done();
        });
        todo.check();
      });

      it('makes computed properties from model methods', function(done) {
        var todo = Todo.create();
        todo.get('computed');
        todo.on('change:computed', function() {
          todo.get('computed').should.equal('Foo');
          done();
        });
        todo.set('title', 'Foo');
      });
    });
  });
});
