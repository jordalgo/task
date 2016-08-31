/**
 * A helper for delaying the execution of a function.
 * Taken from data.task :)
 * @private
 * @summary (Any... -> Any) -> Void
 */
let delayed = setTimeout;
if (typeof setImmediate !== 'undefined') {
  delayed = setImmediate;
} else if (typeof process !== 'undefined') {
  delayed = process.nextTick;
}


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
  const cancel = () => {};
  this.run = function run(observer) {
    let compCalled = false;
    const compCancel = computation((left, right) => {
      if (compCalled) {
        throw new Error('Ask computation can only be called once.');
      }
      compCalled = true;
      delayed(() => {
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
 * @summary ((β → γ) → Ask[α, β]) → Ask[α, γ]
 */
Ask.map = function map(fn, ask) {
  return new Ask(message =>
    ask.run((left, right) => {
      if (left) {
        message(left);
      } else {
        message(null, fn(right));
      }
    })
  );
};

Ask.prototype.map = function _map(fn) {
  return Ask.map(fn, this);
};

/**
 * Transforms the left and right values of the `Ask[α, β]` using two regular unary
 * functions
 *
 * @summary ((a → b), (c → d), Ask[a, c]) → Ask[b, d]
 */
Ask.bimap = function bimap(fnLeft, fnRight, ask) {
  return new Ask(message =>
    ask.run((left, right) => {
      message(fnLeft(left), fnRight(right));
    })
  );
};

Ask.prototype.bimap = function _bimap(fnLeft, fnRight) {
  return Ask.bimap(fnLeft, fnRight, this);
};

/**
 * Transforms the right value of the `Ask[α, β]` using a function to a
 * monad.
 *
 * @summary ((β → Ask[α, γ]) → @Ask[α, β]) → Ask[α, γ]
 */
Ask.chain = function chain(fn, ask) {
  return new Ask(message =>
    ask.run((left, right) => {
      if (left) {
        return message(left);
      }
      return fn(right).run(message);
    })
  );
};

Ask.prototype.chain = function _chain(fn) {
  return Ask.chain(fn, this);
};

/**
 * Passes both the left and right values of the `Ask[α, β]`
 * to a function that returns an `Ask[α, β]`.
 *
 * @summary (((α → β) → Ask[α, γ]) → Ask[α, β]) → Ask[α, γ]
 */
Ask.bichain = function bichain(fn, ask) {
  return new Ask(message =>
    ask.run((left, right) =>
      fn(left, right).run(message)
    )
  );
};

Ask.prototype.bichain = function _bichain(fn) {
  return Ask.bichain(fn, this);
};

/**
 * Applys the right value of the `Ask[α, (β → γ)]` to the right
 * value of the `Ask[α, β]`
 *
 * @summary (Ask[α, β] → Ask[α, (β → γ)]) → Ask[α, γ]
 */
Ask.ap = function ap(askP, askZ) {
  const run = askZ.run;
  let thisRight;
  let thatRight;
  let completed;

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
};

Ask.prototype.ap = function _ap(askP) {
  return Ask.ap(askP, this);
};

/**
 * Take the earlier of the two Asks
 *
 * @summary (Ask[α, β] → Ask[α → β)]) → Ask[α, β]
 */
Ask.concat = function concat(askA, askB) {
  let oneFinished;
  let cancelA;
  let cancelB;
  return new Ask(message => {
    cancelA = askA.run((left, right) => {
      if (oneFinished) return; // guard against no cancelation fn
      oneFinished = true;
      cancelB();
      message(left, right);
    });
    cancelB = askB.run((left, right) => {
      if (oneFinished) return; // guard against no cancelation fn
      oneFinished = true;
      cancelA();
      message(left, right);
    });
    // cancel both
    return () => {
      cancelA();
      cancelB();
    };
  });
};

Ask.prototype.concat = function _concat(askA) {
  return Ask.concat(askA, this);
};

/**
 * Memoizes the left and right values from an Ask[α, β].
 * Run can be called multiple times on the produced Ask
 * and the computation is not re-run.
 *
 * @summary Ask[α, β] → Ask[α, γ]
 */
Ask.memoize = function memoize(ask) {
  const run = ask.run;
  let compCalled = false;
  let runReturned = false;
  let futureLeft;
  let futureRight;
  let messages = [];
  let cancelFn;
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
    return run((left, right) => {
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

Ask.prototype.memoize = function _memoize() {
  return Ask.memoize(this);
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
};

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


/**
 * Returns an Ask that will never resolve
 *
 * @summary Void → Aask[α, _]
 */
Ask.empty = function _empty() {
  return new Ask(() => {});
};

Ask.prototype.empty = Ask.empty;

Ask.prototype.toString = function toString() {
  return 'Ask';
};

/**
 * Factory function for creating a new `Ask[α, β]`
 *
 * @summary ((α → β) → γ) → Ask[α, γ]
 */
Ask.create = function create(comp) {
  return new Ask(comp);
};

/**
 * Creates a single Ask out of many that doesnt complete
 * until each resolve with all rights or a single left occurs.
 * Will pass the incomplete array of rights if some have occured before a left.
 *
 * @summary [Ask[α, γ]] → Ask[α, [γ]]

 */
Ask.all = function(askArray) {
  let rights = [];
  let cancels = [];
  let compCalled = false;

  function cleanUp() {
    cancels = [];
    rights = [];
    compCalled = true;
  }

  return new Ask(message => {
    askArray.forEach(a => {
      const cancel = a.run((left, right) => {
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
