var addMethods = require('./ask-methods');
var delayed = require('./delayed');

function AskOnce(computation) {
  var runCalled = false;
  var compComplete = false;
  var futureLeft;
  var futureRight;
  var cancel = () => {};
  var observers = [];
  this.run = function run(observer) {
    if (runCalled && compComplete) {
      delayed(function() { observer(futureLeft, futureRight); });
      return () => {};
    } else if (runCalled) {
      if (observers.indexOf(observer) === -1) {
        observers.push(observer)
      }
      // if the computation hasn't completed then it can still be canceled.
      return cancel;
    }
    runCalled = true;
    observers.push(observer);

    var compCancel = computation(function(left, right) {
      if (compComplete) {
        throw new Error('Ask computation can only be called once e.g. there can be either an fail or a right. Not both.');
      }
      compComplete = true;
      futureLeft = left;
      futureRight = right;
      observers.forEach(o => {
        delayed(() => {
          o(left, right);
        });
      });

      // clean up the observer references
      delayed(() => {
        observers = [];
      });
    });

    if (typeof compCancel === 'function') {
      cancel = compCancel;
    }

    return cancel;
  };
}

AskOnce.prototype.create = function create(computation) {
  return new AskOnce(computation);
}

AskOnce.create = AskOnce.prototype.create;

AskOnce.prototype.toString = function toString() {
  return 'AskOnce';
}

addMethods(AskOnce.prototype);

// Static Methods
AskOnce.of = function of(right) {
  return new AskOnce(message => {
    message(null, right);
  });
};

AskOnce.ofLeft = function ofLeft(left) {
  return new AskOnce(message => {
    message(left);
  });
};

module.exports = AskOnce;
