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
  console.warn('Task: cancel called on function that did not provide a custom cancel.');
}

/**
 * The `Task[a, b]` structure represents values that depend on time. This
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
 * @summary ((a → b) → c) → Task[a, b]
 */
function Task(computation) {
  this.run = function taskRun(failSub, successSub) {
    let compCalled = false;
    function wrapped(fn) {
      return (val) => {
        if (compCalled) {
          throw new Error('Task computations can call either sendFail or sendSuccess, not both.');
        }
        compCalled = true;
        delayed(() => {
          fn(val);
        });
      };
    }
    const compCancel = computation(wrapped(failSub), wrapped(successSub));
    return (typeof compCancel === 'function') ? compCancel : cancelHolder;
  };
}

/**
 * Transforms the success value of the `Task[l, a]` using a regular unary
 * function.
 *
 * @summary ((a → b) → Task[l, a]) → Ask[l, b]
 */
Task.map = function map(fn, ask) {
  return new Task((sendFail, sendSuccess) =>
    ask.run(
      sendFail,
      success => { sendSuccess(fn(success)); }
    )
  );
};

Task.prototype.map = function _map(fn) {
  return Task.map(fn, this);
};

/**
 * Transforms the fail or success values of the `Task[a, b]` using two regular unary
 * functions depending on what exists.
 *
 * @summary ((a → b), (c → d), Task[a, c]) → Task[b, d]
 */
Task.bimap = function bimap(fnFail, fnSuccess, task) {
  return new Task((sendFail, sendSuccess) =>
    task.run(
      fail => { sendFail(fnFail(fail)); },
      success => { sendSuccess(fnSuccess(success)); }
    )
  );
};

Task.prototype.bimap = function _bimap(fnFail, fnSuccess) {
  return Task.bimap(fnFail, fnSuccess, this);
};

/**
 * Transforms the success value of the `Task[a, b]` using a function to a
 * monad.
 *
 * @summary ((b → Task[c, d]) → @Task[a, b]) → Task[a, d]
 */
Task.chain = function chain(fn, task) {
  return new Task((sendFail, sendSuccess) => {
    let futureCancel = () => {};
    const cancel = task.run(
      sendFail,
      success => {
        futureCancel = fn(success).run(sendFail, sendSuccess);
      }
    );
    return () => {
      cancel();
      futureCancel();
    };
  });
};

Task.prototype.chain = function _chain(fn) {
  return Task.chain(fn, this);
};

/**
 * Passes both the fail and success values of the `Task[a, b]`
 * to a function that returns an `Task[c, d]`.
 *
 * @summary ((a → c) → (b → d) → Task[a, b]) → Task[c, d]
 */
Task.bichain = function bichain(fnFail, fnSuccess, task) {
  return new Task((sendFail, sendSuccess) => {
    let futureCancel = () => {};
    const cancel = task.run(
      fail => {
        futureCancel = fnFail(fail).run(sendFail, sendSuccess);
      },
      success => {
        futureCancel = fnSuccess(success).run(sendFail, sendSuccess);
      }
    );
    return () => {
      cancel();
      futureCancel();
    };
  });
};

Task.prototype.bichain = function _bichain(fnFail, fnSuccess) {
  return Task.bichain(fnFail, fnSuccess, this);
};

/**
 * Applys the success value of the `Task[a, (b → c)]` to the success
 * value of the `Task[d, b]`
 *
 * @summary (Task[d, b] → Task[a, (b → c)]) → Task[a, c]
 */
Task.ap = function ap(taskP, taskZ) {
  let pSuccess;
  let pFail;
  let zSuccess;
  let zFail;
  let completed;

  function runApply(sendFail, sendSuccess) {
    if (sendFail) {
      sendFail(zFail || pFail);
    } else {
      sendSuccess(zSuccess(pSuccess));
    }
  }

  return new Task((sendFail, sendSuccess) => {
    taskP.run(
      fP => {
        pFail = fP;
        if (completed) {
          runApply(sendFail, null);
        } else {
          completed = true;
        }
      },
      sP => {
        pSuccess = sP;
        if (completed) {
          runApply(null, sendSuccess);
        } else {
          completed = true;
        }
      }
    );
    return taskZ.run(
      fZ => {
        zFail = fZ;
        if (completed) {
          runApply(sendFail, null);
        } else {
          completed = true;
        }
      },
      sZ => {
        zSuccess = sZ;
        if (completed) {
          runApply(null, sendSuccess);
        } else {
          completed = true;
        }
      }
    );
  });
};

Task.prototype.ap = function _ap(taskP) {
  return Task.ap(taskP, this);
};

/**
 * Take the earlier of the two Tasks
 *
 * @summary (Task[a, b] → Task[a → b)]) → Task[a, b]
 */
Task.concat = function concat(taskA, taskB) {
  let oneFinished;
  let cancelA;
  let cancelB;
  return new Task((sendFail, sendSuccess) => {
    cancelA = taskA.run(
      lA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelB();
        sendFail(lA);
      },
      rA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelB();
        sendSuccess(rA);
      }
    );
    cancelB = taskB.run(
      lA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelA();
        sendFail(lA);
      },
      rA => {
        if (oneFinished) return;
        oneFinished = true;
        cancelA();
        sendSuccess(rA);
      }
    );
    // cancel both
    return () => {
      cancelA();
      cancelB();
    };
  });
};

Task.prototype.concat = function _concat(taskA) {
  return Task.concat(taskA, this);
};

/**
 * Memoizes the fail and success values from an Task[a, b].
 * Run can be called multiple times on the produced Task
 * and the computation is not re-run.
 *
 * @summary Task[a, b] → Ask[a, b]
 */
Task.memoize = function memoize(task) {
  let compCalled = false;
  let runReturned = false;
  let futureFail;
  let futureSuccess;
  let successSubs = [];
  let failSubs = [];
  let cancelFn;
  return new Task((sendFail, sendSuccess) => {
    if (compCalled && runReturned) {
      if (runReturned === 'fail') {
        sendFail(futureFail);
      } else {
        sendSuccess(futureSuccess);
      }
      return () => {};
    } else if (compCalled) {
      if (failSubs.indexOf(sendFail) === -1) {
        failSubs.push(sendFail);
      }
      if (successSubs.indexOf(sendSuccess) === -1) {
        successSubs.push(sendSuccess);
      }
      return cancelFn;
    }
    compCalled = true;
    successSubs.push(sendSuccess);
    failSubs.push(sendFail);
    return task.run(
      f => {
        runReturned = 'fail';
        futureFail = f;
        failSubs.forEach(sub => {
          sub(f);
        });
        delayed(() => { failSubs = []; });
      },
      s => {
        runReturned = 'success';
        futureSuccess = s;
        successSubs.forEach(sub => {
          sub(s);
        });
        delayed(() => { successSubs = []; });
      }
    );
  });
};

Task.prototype.memoize = function _memoize() {
  return Task.memoize(this);
};

/**
 * Constructs a new `Task[a, b]` containing the single value `b`.
 *
 * `b` can be any value, including `null`, `undefined`, or another
 * `Task[a, b]` structure.
 *
 * @summary b → Task[a, b]
 */
Task.prototype.of = function of(success) {
  return new Task((sendFail, sendSuccess) => {
    sendSuccess(success);
  });
};

Task.of = Task.prototype.of;

/**
 * Constructs a new `Task[a, b]` containing the single value `a`.
 *
 * `a` can be any value, including `null`, `undefined`, or another
 * `Task[a, b]` structure.
 *
 * @summary a → Task[a, b]
 */
Task.prototype.fail = function fail(f) {
  return new Task((sendFail) => {
    sendFail(f);
  });
};

Task.fail = Task.prototype.fail;


/**
 * Returns an Task that will never resolve
 *
 * @summary Void → Task[_, _]
 */
Task.empty = function _empty() {
  return new Task(() => {});
};

Task.prototype.empty = Task.empty;

Task.prototype.toString = function toString() {
  return 'Task';
};

/**
 * Factory function for creating a new `Task[a, b]`
 *
 * @summary ((a → b) → c) → Task[a, b]
 */
Task.create = function create(comp) {
  return new Task(comp);
};

/**
 * Creates a single Task out of many that doesnt complete
 * until each resolve with all successs or a single fail occurs.
 * Will pass the incomplete array of successs if some have occured before a fail.
 *
 * @summary [Task[a, b]] → Task[a, [b]]

 */
Task.all = function(taskArray) {
  let successs = [];
  let cancels = [];
  let compCalled = false;

  function cleanUp() {
    cancels = [];
    successs = [];
    compCalled = true;
  }

  return new Task((sendFail, sendSuccess) => {
    taskArray.forEach(a => {
      const cancel = a.run(
        f => {
          if (compCalled) return;
          cancels.forEach(c => { c(); });
          sendFail(f);
          cleanUp();
        },
        s => {
          if (compCalled) return;
          successs.push(s);
          if (successs.length === taskArray.length) {
            sendSuccess(successs);
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

module.exports = Task;
