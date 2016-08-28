/**
 * A helper for delaying the execution of a function.
 * Taken from data.task :)
 * @private
 * @summary (Any... -> Any) -> Void
 */
var delayed = typeof setImmediate !== 'undefined'?  setImmediate
            : typeof process !== 'undefined'?       process.nextTick
            : /* otherwise */                       setTimeout

function Ask(computation) {
  var runCalled = false;
  var futureLeft;
  var futureRight;
  var cancel = () => {};
  this.run = function run(observer) {
    if (runCalled) {
      delayed(function() { observer(futureLeft, futureRight); });
      return cancel;
    }
    runCalled = true;

    var compCalled = false;
    var compCancel = computation(function(left, right) {
      if (compCalled) {
        throw new left('Ask computation can only be called once e.g. there can be either an fail or a right. Not both.');
      }
      compCalled = true;
      futureLeft = left;
      futureRight = right;
      delayed(function() {
        observer(left, right);
      });
    });

    return (typeof compCancel === 'function') ? compCancel : cancel;
  };
}

Ask.prototype.map = function map(fn) {
  var run = this.run;
  return new Ask(message => {
    return run((left, right) => {
      if (left) {
        message(left);
      } else {
        message(null, fn(right));
      }
    });
  });
}

Ask.prototype.chain = function chain(fn) {
  var run = this.run;
  return new Ask(message => {
    return run((left, right) => {
      if (left) {
        return message(left);
      } else {
        return fn(right).run(message);
      }
    });
  });
}

Ask.prototype.biChain = function biChain(fn) {
  var run = this.run;
  return new Ask(message => {
    return run((left, right) => {
      return fn(left, right).run(message);
    });
  });
}

Ask.prototype.ap = function ap(askP) {
  var run = this.run;
  var thisRight;
  var thatRight;
  var completed;

  function runApply(message) {
    message(null, thisRight(thatRight));
  }

  return new Ask(message => {
    askP.run((leftP, rightP) => {
      if (leftP) return;
      thatRight = rightP;
      if (completed) {
        runApply(message);
      } else {
        completed = true;
      }
    });
    return run((left, right) => {
      if (left) {
        message(left);
      } else {
        thisRight = right;
        if (completed) {
          runApply(message);
        } else {
          completed = true;
        }
      }
    });
  });
}

Ask.prototype.of = function of(right) {
  return new Ask(message => {
    message(null, right);
  });
}

Ask.of = Ask.prototype.of;

Ask.prototype.ofLeft = function ofLeft(left) {
  return new Ask(message => {
    message(left);
  });
};

Ask.ofLeft = Ask.prototype.ofLeft;

Ask.prototype.toString = function toString() {
  return 'Ask';
}

module.exports = Ask;
