var _ = require('./utils.js');


var UndoManager = function(items) {
  var milestones = [{}];
  var reverseIndex = 0;
  var dontRecord = false;

  var currentMilestone = function() {
    return milestones[milestones.length - reverseIndex - 1];
  };

  // Save all objects with their data from the given milestone
  // The resulting change events are suppressed
  var restoreMilestone = function(stone) {
    dontRecord = true;
    _.each(stone, function(change, id) {
      change.obj.save(change.data);
    });
    dontRecord = false;
  };

  var self = {
    // Add a fresh model instance to be tracked
    add: function(inst) {
      if(_.onServer()) return self;
      var storeChange = function() {
        _.last(milestones)[inst.localId] = {
          obj: inst,
          data: inst.properties()
        };
      };
      storeChange();
      inst.on('change', function() {
        if(!dontRecord) storeChange();
      });
      //XXX also record object deletion
      return self;
    },

    // Save all recently changed objects and begin a fresh milestone
    save: function() {
      _.each(_.last(milestones), function(change, id) {
        change.obj.save();
      });
      milestones.push({});
      reverseIndex = 0;
      return self;
    },

    back: function() {
      if(!(milestones.length > reverseIndex + 1)) return;
      reverseIndex++;
      restoreMilestone(currentMilestone());
      return self;
    },

    forward: function() {
      if(reverseIndex == 0) return;
      reverseIndex--;
      restoreMilestone(currentMilestone());
      return self;
    }
  };

  // Create a base milestone from the given items
  _.each(items, function(inst) {
    self.add(inst);
  });
  self.save();

  return self;
};


module.exports = UndoManager;

