var Utils = require('./utils.js');


// When passed to the template evaluator, its render method will create a virtual DOM
// Call render on the virtual DOM again to serialize it to actual html
var StreamInterface = function() {
  var pending = 0;
  var streamCb;
  var topNode;

  return {
    createFragment: function() {
      var elem = this.createDOMElement();
      elem._fragment = true;
      return elem;
    },

    createDOMElement: function(tag, id, classes, attributes) {
      return {
        tag: tag,
        id: id,
        classes: classes,
        attributes: attributes,
        children: [],
        finished: true,

        // Don't register actions handlers on the server
        on: function() {},

        append: function(elem) {
          this.children.push(elem);
        },

        text: function(text) {
          this.tekst = text;
        },

        // Called when an asynchronous operation on this element begins
        unfinish: function() {
          this.finished = false;
          pending++;
        },

        // Called when an asynchronous operation on this element is finished
        // Tries to render another chunk
        finish: function() {
          this.finished = true;
          pending--;
          topNode && topNode.render();
        },

        // If render is called before all views have been fully resolved, the callback
        // function will be called several times, receiving a chunk of html with every invocation
        render: function(cb) {
          if(cb) {
            streamCb = cb;
            topNode = this;
          }
          var segment = this.serialize().html;
          streamCb({data: segment, eof: !pending});
        },

        // Serialize recursively, but stop as soon as
        // an unfinished node is encountered
        serialize: function() {
          var html = '';
          if(!this.topSerialized) {
            // Begin tag
            if(!this._fragment) {
              html += '<' + this.tag;
              var addAttr = function(key, val) {
                if(!val) return;
                html += ' ' + key + '="' + val + '"';
              };
              if(this.id) addAttr('id', this.id);
              if(this.classes && this.classes.length) addAttr('class', this.classes.join(' '));
              if(this.attributes) {
                for(var attr in this.attributes) {
                  var val = this.attributes[attr];
                  addAttr(attr, val);
                }
              }
              html += '>';
            }
            // Free text
            if(this.tekst) {
              html += this.tekst;
            }
            this.topSerialized = true;
          }
          // Recurse
          var terminated = false;
          for(var i in this.children) {
            var child = this.children[i];
            if(child.finished) {
              var out = child.serialize();
              html += out.html;
              // Also terminate if child terminated
              if(out.terminated) {
                terminated = true;
                break;
              }
            } else {
              terminated = true;
              break;
            }
          }
          // End tag
          if(!this.bottomSerialized && !terminated && !this._fragment) {
            html += '</' + this.tag + '>';
            this.bottomSerialized = true;
          }
          return {html: html, terminated: terminated};
        }
      };
    }
  };
};


module.exports = StreamInterface;
