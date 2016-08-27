function Ask(computation) {
  var runCalled = false;
  var futureLeft;
  var futureRight;
  var cancel = () => {};
  this.run = function run(observer) {
    if (runCalled) {
      setTimeout(function() {
        observer(futureLeft, futureRight);
      }, 0);
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
      setTimeout(function() {
        observer(left, right);
      }, 0);
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

Ask.prototype.of = function of(left, right) {
  return new Ask(message => {
    message(left, right);
  });
}

Ask.of = Ask.prototype.of;

Ask.prototype.toString = function toString() {
  return 'Ask';
}

module.exports = Ask;
