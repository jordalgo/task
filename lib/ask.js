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

function cancelHolder() {
  console.warn('Ask: cancel called on function that did not provide a custom cancel.');
}

/**
 * The `Ask[a, b]` structure represents values that depend on time. This
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
 * @summary ((a → b) → c) → Ask[a, b]
 */
function Ask(computation) {
  this.run = function taskRun(leftSub, rightSub) {
    let compCalled = false;
    function wrapped(fn) {
      return (val) => {
        if (compCalled) {
          throw new Error('Ask computations can call either left or right, not both.');
        }
        compCalled = true;
        delayed(() => {
          fn(val);
        });
      };
    }
    const compCancel = computation(wrapped(leftSub), wrapped(rightSub));
    return (typeof compCancel === 'function') ? compCancel : cancelHolder;
  };
}

/**
 * Transforms the right value of the `Ask[l, a]` using a regular unary
 * function.
 *
 * @summary ((a → b) → Ask[l, a]) → Ask[l, b]
 */
Ask.map = function map(fn, ask) {
  return new Ask((left, right) =>
    ask.run(
      left,
      x => { right(fn(x)); }
    )
  );
};

Ask.prototype.map = function _map(fn) {
  return Ask.map(fn, this);
};

/**
 * Transforms the left or right values of the `Ask[α, β]` using two regular unary
 * functions depending on what exists.
 *
 * @summary ((a → b), (c → d), Ask[a, c]) → Ask[b, d]
 */
Ask.bimap = function bimap(fnLeft, fnRight, ask) {
  return new Ask((left, right) =>
    ask.run(
      a => { left(fnLeft(a)); },
      b => { right(fnRight(b)); }
    )
  );
};

Ask.prototype.bimap = function _bimap(fnLeft, fnRight) {
  return Ask.bimap(fnLeft, fnRight, this);
};

/**
 * Transforms the right value of the `Ask[a, b]` using a function to a
 * monad.
 *
 * @summary ((b → Ask[c, d]) → @Ask[a, b]) → Ask[a, d]
 */
Ask.chain = function chain(fn, ask) {
  return new Ask((left, right) => {
    let futureCancel = () => {};
    const cancel = ask.run(
      left,
      r => {
        futureCancel = fn(r).run(left, right);
      }
    );
    return () => {
      cancel();
      futureCancel();
    };
  });
};

Ask.prototype.chain = function _chain(fn) {
  return Ask.chain(fn, this);
};

/**
 * Passes both the left and right values of the `Ask[a, b]`
 * to a function that returns an `Ask[c, d]`.
 *
 * @summary ((a → c) → (b → d) → Ask[a, b]) → Ask[c, d]
 */
Ask.bichain = function bichain(fnLeft, fnRight, ask) {
  return new Ask((left, right) => {
    let futureCancel = () => {};
    const cancel = ask.run(
      l => {
        futureCancel = fnLeft(l).run(left, right);
      },
      r => {
        futureCancel = fnRight(r).run(left, right);
      }
    );
    return () => {
      cancel();
      futureCancel();
    };
  });
};

Ask.prototype.bichain = function _bichain(fnLeft, fnRight) {
  return Ask.bichain(fnLeft, fnRight, this);
};

/**
 * Applys the right value of the `Ask[a, (b → c)]` to the right
 * value of the `Ask[d, b]`
 *
 * @summary (Ask[d, b] → Ask[a, (b → c)]) → Ask[a, c]
 */
Ask.ap = function ap(askP, askZ) {
  let pRight;
  let pLeft;
  let zRight;
  let zLeft;
  let completed;

  function runApply(left, right) {
    if (left) {
      left(zLeft || pLeft);
    } else {
      right(zRight(pRight));
    }
  }

  return new Ask((left, right) => {
    askP.run(
      lP => {
        pLeft = lP;
        if (completed) {
          runApply(left, null);
        } else {
          completed = true;
        }
      },
      rP => {
        pRight = rP;
        if (completed) {
          runApply(null, right);
        } else {
          completed = true;
        }
      }
    );
    return askZ.run(
      lZ => {
        zLeft = lZ;
        if (completed) {
          runApply(left, null);
        } else {
          completed = true;
        }
      },
      zP => {
        zRight = zP;
        if (completed) {
          runApply(null, right);
        } else {
          completed = true;
        }
      }
    );
  });
};

Ask.prototype.ap = function _ap(askP) {
  return Ask.ap(askP, this);
};

/**
 * Take the earlier of the two Asks
 *
 * @summary (Ask[a, b] → Ask[a → b)]) → Ask[a, b]
 */
Ask.concat = function concat(askA, askB) {
  let oneFinished;
  let cancelA;
  let cancelB;
  return new Ask((left, right) => {
    cancelA = askA.run(
      lA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelB();
        left(lA);
      },
      rA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelB();
        right(rA);
      }
    );
    cancelB = askB.run(
      lA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelA();
        left(lA);
      },
      rA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelA();
        right(rA);
      }
    );
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
 * Memoizes the left and right values from an Ask[a, b].
 * Run can be called multiple times on the produced Ask
 * and the computation is not re-run.
 *
 * @summary Ask[a, b] → Ask[a, b]
 */
Ask.memoize = function memoize(ask) {
  let compCalled = false;
  let runReturned = false;
  let futureLeft;
  let futureRight;
  let rightSubs = [];
  let leftSubs = [];
  let cancelFn;
  return new Ask((left, right) => {
    if (compCalled && runReturned) {
      if (runReturned === 'left') {
        left(futureLeft);
      } else {
        right(futureRight);
      }
      return () => {};
    } else if (compCalled) {
      if (leftSubs.indexOf(left) === -1) {
        leftSubs.push(left);
      }
      if (rightSubs.indexOf(right) === -1) {
        rightSubs.push(right);
      }
      return cancelFn;
    }
    compCalled = true;
    rightSubs.push(right);
    leftSubs.push(left);
    return ask.run(
      l => {
        runReturned = 'left';
        futureLeft = l;
        leftSubs.forEach(sub => {
          sub(l);
        });
        delayed(() => { leftSubs = []; });
      },
      r => {
        runReturned = 'right';
        futureRight = r;
        rightSubs.forEach(sub => {
          sub(r);
        });
        delayed(() => { rightSubs = []; });
      }
    );
  });
};

Ask.prototype.memoize = function _memoize() {
  return Ask.memoize(this);
};

/**
 * Constructs a new `Ask[a, b]` containing the single value `b`.
 *
 * `b` can be any value, including `null`, `undefined`, or another
 * `Ask[a, b]` structure.
 *
 * @summary b → Ask[a, b]
 */
Ask.prototype.of = function of(r) {
  return new Ask((left, right) => {
    right(r);
  });
};

Ask.of = Ask.prototype.of;

/**
 * Constructs a new `Ask[a, b]` containing the single value `a`.
 *
 * `a` can be any value, including `null`, `undefined`, or another
 * `Ask[a, b]` structure.
 *
 * @summary a → Ask[a, b]
 */
Ask.prototype.ofLeft = function ofLeft(l) {
  return new Ask((left) => {
    left(l);
  });
};

Ask.ofLeft = Ask.prototype.ofLeft;


/**
 * Returns an Ask that will never resolve
 *
 * @summary Void → Aask[_, _]
 */
Ask.empty = function _empty() {
  return new Ask(() => {});
};

Ask.prototype.empty = Ask.empty;

Ask.prototype.toString = function toString() {
  return 'Ask';
};

/**
 * Factory function for creating a new `Ask[a, b]`
 *
 * @summary ((a → b) → c) → Ask[a, b]
 */
Ask.create = function create(comp) {
  return new Ask(comp);
};

/**
 * Creates a single Ask out of many that doesnt complete
 * until each resolve with all rights or a single left occurs.
 * Will pass the incomplete array of rights if some have occured before a left.
 *
 * @summary [Ask[a, b]] → Ask[a, [b]]

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

  return new Ask((left, right) => {
    askArray.forEach(a => {
      const cancel = a.run(
        l => {
          if (compCalled) return;
          cancels.forEach(c => { c(); });
          left(l);
          cleanUp();
        },
        r => {
          if (compCalled) return;
          rights.push(r);
          if (rights.length === askArray.length) {
            right(rights);
            cleanUp();
          }
        }
      );
      cancels.push(cancel);
      return () => {
        cancels.forEach(c => { c(); });
      };
    });
  });
};

module.exports = Ask;
