var Utils = require('./utils.js');


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

        on: function() {
          // Don't register actions handlers on the server
        },

        append: function(elem) {
          this.children.push(elem);
        },

        text: function(text) {
          this.tekst = text;
        },

        unfinish: function() {
          this.finished = false;
          pending++;
        },

        finish: function() {
          this.finished = true;
          pending--;
          topNode && topNode.render();
        },

        serialize: function() {
          var html = '';
          if(!this.topSerialized && !this._fragment) {
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
            if(this.tekst) {
              html += this.tekst;
            }
            this.topSerialized = true;
          }
          var terminated = false;
          for(var i in this.children) {
            var child = this.children[i];
            if(child.finished) {
              var out = child.serialize();
              html += out.html;
              if(out.terminated) {
                terminated = true;
                break;
              }
            } else {
              terminated = true;
              break;
            }
          }
          if(!this.bottomSerialized && !terminated && !this._fragment) {
            html += '</' + this.tag + '>';
            this.bottomSerialized = true;
          }
          return {html: html, terminated: terminated};
        },

        render: function(cb) {
          if(cb) {
            streamCb = cb;
            topNode = this;
          }
          var segment = this.serialize().html;
          streamCb({data: segment, eof: !pending});
        }
      };
    }
  };
};


module.exports = StreamInterface;
