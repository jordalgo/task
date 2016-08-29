var METHODS = {
  map(fn) {
    var run = this.run;
    return this.create(message => {
      return run((left, right) => {
        if (left) {
          message(left);
        } else {
          message(null, fn(right));
        }
      });
    });
  },

  chain(fn) {
    var run = this.run;
    return this.create(message => {
      return run((left, right) => {
        if (left) {
          return message(left);
        } else {
          return fn(right).run(message);
        }
      });
    });
  },

  biChain(fn) {
    var run = this.run;
    return this.create(message => {
      return run((left, right) => {
        return fn(left, right).run(message);
      });
    });
  },

  ap(askP) {
    var run = this.run;
    var thisRight;
    var thatRight;
    var completed;

    function runApply(message) {
      message(null, thisRight(thatRight));
    }

    return this.create(message => {
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
  },

  of(right) {
    return this.create(message => {
      message(null, right);
    });
  },

  ofLeft(left) {
    return this.create(message => {
      message(left);
    });
  },

};

function addMethods(target) {
  Object.keys(METHODS).forEach(k => {
    var desc = Object.getOwnPropertyDescriptor(METHODS, k);
    desc.enumerable = false;
    Object.defineProperty(target, k, desc);
  });
}

module.exports = addMethods;
