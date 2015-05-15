var _declaireLog = [];
var _declaireLogHandlers = {};

(function() {
  // Listen for events on html element and save these to the log
  var trackEvent = function(name) {
    var handler = function(e) {
      //XXX add id to element
      _declaireLog.push(e);
    };
    var html = document.getElementsByTagName('html')[0];
    html.addEventListener(name, handler);
    return handler;
  };
  // Track all user input relevant event types and save
  // the handlers for later removal
  var events = ['click', 'keypress'];
  for(var i = 0; i < events.length; i++) {
    _declaireLogHandlers[events[i]] = trackEvent(events[i]);
  };
})();
