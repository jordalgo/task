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
 * _Signature_: ((a → b) → c) → Task[a, b]
 *
 * @class
 * @param {Function} computation
 */
function Task(computation) {
  this.run = task$run.bind(null, computation);
}

function task$run(computation, failSub, successSub) {
  let complete = false;
  const compCancel = computation(
    function task$FailSub(val) {
      if (complete) return;
      complete = true;
      failSub(val);
    },
    function task$SuccessSub(val) {
      if (complete) return;
      complete = true;
      successSub(val);
    }
  );
  return function task$Cancel() {
    if (complete) return;
    complete = true;
    if (typeof compCancel === 'function') {
      compCancel();
    }
  };
}

/**
 * Transforms the success value of the `Task[l, a]` using a regular unary
 * function.
 *
 * _Signature_: ((a → b) → Task[l, a]) → Task[l, b]
 *
 * @param {Function} fn
 * @param {Task} task
 * @return {Task}
 */
Task.map = function task$map(fn, task) {
  return new Task((sendFail, sendSuccess) =>
    task.run(
      sendFail,
      success => { sendSuccess(fn(success)); }
    )
  );
};

Task.prototype.map = function _task$map(fn) {
  return Task.map(fn, this);
};

/**
 * Transforms the fail or success values of the `Task[a, b]` using two regular unary
 * functions depending on what exists.
 *
 * _Signature_: ((a → b), (c → d), Task[a, c]) → Task[b, d]
 *
 * @param {Function} fnFail
 * @param {Function} fnSuccess
 * @param {Task} task
 * @return {Task}
 */
Task.bimap = function task$bimap(fnFail, fnSuccess, task) {
  return new Task((sendFail, sendSuccess) =>
    task.run(
      fail => { sendFail(fnFail(fail)); },
      success => { sendSuccess(fnSuccess(success)); }
    )
  );
};

Task.prototype.bimap = function _task$bimap(fnFail, fnSuccess) {
  return Task.bimap(fnFail, fnSuccess, this);
};

/**
 * Transforms the success value of the `Task[a, b]` using a function to a
 * monad.
 *
 * _Signature_: ((b → Task[c, d]) → @Task[a, b]) → Task[a, d]
 *
 * @param {Function} fn
 * @param {Task} task
 * @return {Task}
 */
Task.chain = function task$chain(fn, task) {
  return new Task((sendFail, sendSuccess) => {
    let futureCancel;
    const cancel = task.run(
      sendFail,
      success => {
        futureCancel = fn(success).run(sendFail, sendSuccess);
      }
    );
    return function task$chain$cancel() {
      cancel();
      if (futureCancel) futureCancel();
    };
  });
};

Task.prototype.chain = function _task$chain(fn) {
  return Task.chain(fn, this);
};

/**
 * Passes both the fail and success values of the `Task[a, b]`
 * to a function that returns an `Task[c, d]`.
 *
 * _Signature_: ((a → c) → (b → d) → Task[a, b]) → Task[c, d]
 *
 * @param {Function} fnFail
 * @param {Function} fnSuccess
 * @param {Task} task
 * @return {Task}
 */
Task.bichain = function task$bichain(fnFail, fnSuccess, task) {
  return new Task((sendFail, sendSuccess) => {
    let futureCancel;
    const cancel = task.run(
      fail => {
        futureCancel = fnFail(fail).run(sendFail, sendSuccess);
      },
      success => {
        futureCancel = fnSuccess(success).run(sendFail, sendSuccess);
      }
    );
    return function task$bichain$cancel() {
      cancel();
      if (futureCancel) futureCancel();
    };
  });
};

Task.prototype.bichain = function _task$bichain(fnFail, fnSuccess) {
  return Task.bichain(fnFail, fnSuccess, this);
};

/**
 * Applys the success value of the `Task[a, (b → c)]` to the success
 * value of the `Task[d, b]`
 *
 * _Signature_: (Task[d, b] → Task[a, (b → c)]) → Task[a, c]
 *
 * @param {Task} taskP
 * @param {Task} taskZ
 * @return {Task}
 */
Task.ap = function task$ap(taskP, taskZ) {
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

Task.prototype.ap = function _task$ap(taskP) {
  return Task.ap(taskP, this);
};

/**
 * Take the earlier of the two Tasks
 *
 * _Signature_: (Task[a, b] → Task[a → b)]) → Task[a, b]
 *
 * @param {Task} taskA
 * @param {Task} taskB
 * @return {Task}
 */
Task.concat = function task$concat(taskA, taskB) {
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
    return function task$concat$cancel() {
      cancelA();
      cancelB();
    };
  });
};

Task.prototype.concat = function _task$concat(taskA) {
  return Task.concat(taskA, this);
};

/**
 * Caches the fail and success values from an Task[a, b].
 * Run can be called multiple times on the produced Task
 * and the computation is not re-run.
 *
 * _Signature_: Task[a, b] → Ask[a, b]
 *
 * @param {Task} task
 * @return {Task}
 */
Task.cache = function task$cache(task) {
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
        failSubs = [];
      },
      s => {
        runReturned = 'success';
        futureSuccess = s;
        successSubs.forEach(sub => {
          sub(s);
        });
        successSubs = [];
      }
    );
  });
};

Task.prototype.cache = function _task$cache() {
  return Task.cache(this);
};

/**
 * Constructs a new `Task[a, b]` containing the single value `b`.
 *
 * `b` can be any value, including `null`, `undefined`, or another
 * `Task[a, b]` structure.
 *
 * _Signature_: b → Task[_, b]
 *
 * @param {*} success
 * @return {Task}
 */
Task.of = function task$of(success) {
  return new Task((sendFail, sendSuccess) => {
    sendSuccess(success);
  });
};

Task.prototype.of = Task.of;

/**
 * Constructs a new `Task[a, b]` containing the single value `a`.
 *
 * `a` can be any value, including `null`, `undefined`, or another
 * `Task[a, b]` structure.
 *
 * _Signature_: a → Task[a, _]
 *
 * @param {*} f
 * @return {Task}
 */
Task.fail = function task$fail(f) {
  return new Task((sendFail) => {
    sendFail(f);
  });
};

Task.prototype.fail = Task.fail;


/**
 * Returns an Task that will never resolve
 *
 * _Signature_: Void → Task[_, _]
 *
 * @return {Task}
 */
Task.empty = function task$empty() {
  return new Task(() => {});
};

Task.prototype.empty = Task.empty;

Task.prototype.toString = function task$toString() {
  return 'Task';
};

/**
 * Factory function for creating a new `Task[a, b]`
 *
 * _Signature_: ((a → b) → c) → Task[a, b]
 *
 * @param {Function} computation
 * @return {Task}
 */
Task.create = function task$create(computation) {
  return new Task(computation);
};

/**
 * Creates a single Task out of many that doesnt complete
 * until each resolve with all successs or a single fail occurs.
 * Will pass the incomplete array of successs if some have occured before a fail.
 *
 * _Signature_: [Task[a, b]] → Task[a, [b]]
 *
 * @param {Array} taskArray
 * @return {Task}
 */
Task.all = function task$all(taskArray) {
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
      return function task$all$cancel() {
        cancels.forEach(c => { c(); });
      };
    });
  });
};

module.exports = Task;
