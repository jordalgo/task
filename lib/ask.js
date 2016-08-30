/**
 * A helper for delaying the execution of a function.
 * Taken from data.task :)
 * @private
 * @summary (Any... -> Any) -> Void
 */
var delayed = typeof setImmediate !== 'undefined'?  setImmediate
            : typeof process !== 'undefined'?       process.nextTick
            : /* otherwise */                       setTimeout


/**
 * The `Ask[α, β]` structure represents values that depend on time. This
 * allows one to model time-based effects explicitly, such that one can have
 * full knowledge of when they're dealing with delayed computations, latency,
 * or anything that can not be computed immediately.
 *
 * A common use for this structure is to replace the usual Continuation-Passing
 * Style form of programming or Promises (if you prefer not to have your error catching
 * and rejection values handled similarly), in order to be able to compose and sequence
 * time-dependent effects using the generic and powerful monadic operations.
 *
 * @class
 * @summary ((α → β) → γ) → Ask[α, β]
 */

function Ask(computation) {
  var cancel = () => {};
  this.run = function run(observer) {
    var compCalled = false;
    var compCancel = computation(function(left, right) {
      if (compCalled) {
        throw new Error('Ask computation can only be called once e.g. there can be either a left or a right. Not both at different times.');
      }
      compCalled = true;
      delayed(function() {
        observer(left, right);
      });
    });

    return (typeof compCancel === 'function') ? compCancel : cancel;
  };
}

/**
 * Transforms the right value of the `Ask[α, β]` using a regular unary
 * function.
 *
 * @summary @Ask[α, β] => (β → γ) → Ask[α, γ]
 */
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

/**
 * Transforms the right value of the `Ask[α, β]` using a function to a
 * monad.
 *
 * @summary @Ask[α, β] => (β → Ask[α, γ]) → Ask[α, γ]
 */
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

/**
 * Passes both the left and right values of the `Ask[α, β]`
 * to a function that returns an `Ask[α, β]`.
 *
 * @summary @Ask[α, β] => (α → β → Ask[α, γ]) → Ask[α, γ]
 */
Ask.prototype.biChain = function biChain(fn) {
  var run = this.run;
  return new Ask(message => {
    return run((left, right) => {
      return fn(left, right).run(message);
    });
  });
}

/**
 * Applys the right value of the `Ask[α, (β → γ)]` to the right
 * value of the `Ask[α, β]`
 *
 * @summary @Ask[α, (β → γ)] => Ask[α, β] → Ask[α, γ]
 */
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

/**
 * Memoizes the left and right values from an Ask[α, β].
 * Run can be called multiple times on the produced Ask
 * and the computation is not re-run.
 *
 * @summary @Ask[α, β] => Ask[α, γ]
 */
Ask.prototype.memoize = function memoize() {
  var run = this.run;
  var compCalled = false;
  var runReturned = false;
  var futureLeft;
  var futureRight;
  var messages = [];
  var cancelFn;
  return new Ask(message => {
    if (compCalled && runReturned) {
      message(futureLeft, futureRight);
      return () => {};
    } else if (compCalled) {
      if (messages.indexOf(messages) === -1) {
        messages.push(message);
      }
      return cancelFn;
    }
    compCalled = true;
    messages.push(message);
    run((left, right) => {
      runReturned = true;
      futureLeft = left;
      futureRight = right;
      messages.forEach(m => {
        m(left, right);
      });
      delayed(() => { messages = []; });
    });
  });
};


/**
 * Constructs a new `Ask[α, β]` containing the single value `β`.
 *
 * `β` can be any value, including `null`, `undefined`, or another
 * `Ask[α, β]` structure.
 *
 * @summary β → Ask[α, β]
 */
Ask.prototype.of = function of(right) {
  return new Ask(message => {
    message(null, right);
  });
}

Ask.of = Ask.prototype.of;

/**
 * Constructs a new `Ask[α, β]` containing the single value `α`.
 *
 * `α` can be any value, including `null`, `undefined`, or another
 * `Ask[α, β]` structure.
 *
 * @summary β → Ask[α, β]
 */
Ask.prototype.ofLeft = function ofLeft(left) {
  return new Ask(message => {
    message(left);
  });
};

Ask.ofLeft = Ask.prototype.ofLeft;

Ask.prototype.toString = function toString() {
  return 'Ask';
}

/**
 * Factory function for creating a new `Ask[α, β]`
 *
 * @summary ((α → β) → γ) → Ask[α, γ]
 */
Ask.create = function create(comp) {
  return new Ask(comp);
}

/**
 * Creates a single Ask out of many that doesnt complete
 * until each resolve with all rights or a single left occurs.
 * Will pass the incomplete array of rights if some have occured before a left.
 *
 * @summary [Ask[α, γ]] → Ask[α, [γ]]

 */
Ask.all = function(askArray) {
  var rights = [];
  var cancels = [];
  var compCalled = false;

  function cleanUp() {
    cancels = [];
    rights = [];
    compCalled = true;
  }

  return new Ask(message => {
    askArray.forEach(a => {
      var cancel = a.run((left, right) => {
        if (compCalled) return;
        if (left) {
          cancels.forEach(c => { c(); });
          message(left, rights);
          cleanUp();
        } else {
          rights.push(right);
          if (rights.length === askArray.length) {
            message(null, rights);
            cleanUp();
          }
        } 
      });
      cancels.push(cancel);
    });
  });
};

module.exports = Ask;
