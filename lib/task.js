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
 */

const TYPEOF_TASK = 'jordalgo/task';

const checker = {
  check: () => {},
};

/**
 * Constructor
 * _Signature_: ((a → b) → c → void) → Task[a, b]
 *
 * @class
 * @param {Function} computation
 */
function Task(computation) {
  checker.check('create', computation);
  this.computation = computation;
}

Task.prototype['@@type'] = TYPEOF_TASK;

Task.prototype.run = function task$run(sendFail, sendSuccess) {
  checker.check('run', sendFail, sendSuccess);
  let complete = false;
  const cancel = this.computation(
    function task$SendFail(val) {
      if (complete) return;
      complete = true;
      sendFail(val);
    },
    function task$SendSuccess(val) {
      if (complete) return;
      complete = true;
      sendSuccess(val);
    }
  );
  return function task$Cancel() {
    if (complete) return;
    complete = true;
    if (typeof cancel === 'function') {
      cancel();
    }
  };
};

/**
 * Transforms the success value of the `Task[_, a]` using a regular unary
 * function.
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: ((a → b) → Task[_, a]) → Task[_, b]
 *
 * @param {Function} mapper
 * @param {Task} task (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.map = function task$map(mapper, task) {
  checker.check('map', mapper, task);
  return new Task((sendFail, sendSuccess) =>
    task.run(
      sendFail,
      success => { sendSuccess(mapper(success)); }
    )
  );
};

Task.prototype.map = function _task$map(mapper) {
  return Task.map(mapper, this);
};

/**
 * Transforms the fail or success values of the `Task[a, b]` using two regular unary
 * functions depending on what exists.
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: ((a → b), (c → d), Task[a, c]) → Task[b, d]
 *
 * @param {Function} mapValueFail
 * @param {Function} mapValueSuccess
 * @param {Task} task (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.bimap = function task$bimap(mapValueFail, mapValueSuccess, task) {
  checker.check('bimap', mapValueFail, mapValueSuccess, task);
  return new Task((sendFail, sendSuccess) =>
    task.run(
      fail => { sendFail(mapValueFail(fail)); },
      success => { sendSuccess(mapValueSuccess(success)); }
    )
  );
};

Task.prototype.bimap = function _task$bimap(mavalueFail, mavalueSuccess) {
  return Task.bimap(mavalueFail, mavalueSuccess, this);
};

/**
 * Transforms the success value of the `Task[a, b]` using a function to a
 * monad.
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: ((b → Task[c, d]) → @Task[a, b]) → Task[c, d]
 *
 * @param {Function} taskMaker
 * @param {Task} task (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.chain = function task$chain(taskMaker, task) {
  checker.check('chain', taskMaker, task);
  return new Task((sendFail, sendSuccess) => {
    let futureCancel;
    const cancel = task.run(
      sendFail,
      success => {
        futureCancel = taskMaker(success).run(sendFail, sendSuccess);
      }
    );
    return function task$chain$cancel() {
      cancel();
      if (futureCancel) futureCancel();
    };
  });
};

Task.prototype.chain = function _task$chain(taskMaker) {
  return Task.chain(taskMaker, this);
};

/**
 * Passes both the fail and success values of the `Task[a, b]`
 * to a function that returns an `Task[d, e]`.
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: (a → Task[d, e]) → (b → Task[d, e]) → Task[d, e]
 *
 * @param {Function} taskMakerOnFail
 * @param {Function} taskMakerOnSuccess
 * @param {Task} task (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.bichain = function task$bichain(taskMakerOnFail, taskMakerOnSuccess, task) {
  checker.check('bichain', taskMakerOnFail, taskMakerOnSuccess, task);
  return new Task((sendFail, sendSuccess) => {
    let futureCancel;
    const cancel = task.run(
      fail => {
        futureCancel = taskMakerOnFail(fail).run(sendFail, sendSuccess);
      },
      success => {
        futureCancel = taskMakerOnSuccess(success).run(sendFail, sendSuccess);
      }
    );
    return function task$bichain$cancel() {
      cancel();
      if (futureCancel) futureCancel();
    };
  });
};

Task.prototype.bichain = function _task$bichain(taskMakerOnFail, taskMakerOnSuccess) {
  return Task.bichain(taskMakerOnFail, taskMakerOnSuccess, this);
};

/**
 * Applys the success value of the `Task[_, (b → c)]` to the success
 * value of the `Task[d, b]`
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: (Task[d, b] → Task[_, (b → c)]) → Task[_, c]
 *
 * @param {Task} taskValue
 * @param {Task} taskFunction (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.ap = function task$ap(taskValue, taskFunction) {
  checker.check('ap', taskValue, taskFunction);
  let valueSuccess;
  let valueFail;
  let functionSuccess;
  let functionFail;
  let completed;

  function runApply(sendFail, sendSuccess) {
    if (sendFail) {
      sendFail(functionFail || valueFail);
    } else {
      sendSuccess(functionSuccess(valueSuccess));
    }
  }

  return new Task((sendFail, sendSuccess) => {
    taskValue.run(
      fail => {
        valueFail = fail;
        if (completed) {
          runApply(sendFail, null);
        } else {
          completed = true;
        }
      },
      success => {
        valueSuccess = success;
        if (completed) {
          runApply(null, sendSuccess);
        } else {
          completed = true;
        }
      }
    );
    return taskFunction.run(
      fail => {
        functionFail = fail;
        if (completed) {
          runApply(sendFail, null);
        } else {
          completed = true;
        }
      },
      success => {
        functionSuccess = success;
        if (completed) {
          runApply(null, sendSuccess);
        } else {
          completed = true;
        }
      }
    );
  });
};

Task.prototype.ap = function _task$ap(taskValue) {
  return Task.ap(taskValue, this);
};

/**
 * Take the earlier of the two Tasks
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: (Task[a, b] → Task[a → b)]) → Task[a, b]
 *
 * @param {Task} taskA
 * @param {Task} taskB (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.concat = function task$concat(taskA, taskB) {
  checker.check('concat', taskA, taskB);
  let oneFinished;
  let cancelA;
  let cancelB;
  return new Task((sendFail, sendSuccess) => {
    cancelA = taskA.run(
      fail => {
        if (oneFinished) return;
        oneFinished = true;
        cancelB();
        sendFail(fail);
      },
      success => {
        if (oneFinished) return;
        oneFinished = true;
        cancelB();
        sendSuccess(success);
      }
    );
    cancelB = taskB.run(
      fail => {
        if (oneFinished) return;
        oneFinished = true;
        cancelA();
        sendFail(fail);
      },
      success => {
        if (oneFinished) return;
        oneFinished = true;
        cancelA();
        sendSuccess(success);
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
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: Task[a, b] → Task[a, b]
 *
 * @param {Task} task (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.cache = function task$cache(task) {
  checker.check('cache', task);
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
      fail => {
        runReturned = 'fail';
        futureFail = fail;
        failSubs.forEach(sub => {
          sub(fail);
        });
        failSubs = [];
      },
      success => {
        runReturned = 'success';
        futureSuccess = success;
        successSubs.forEach(sub => {
          sub(success);
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
 * Constructs a new `Task[_, b]` containing the single success value `b`.
 *
 * `b` can be any value, including `null`, `undefined`, or another
 * `Task[a, b]` structure.
 *
 * Exposed as both a static function and a method on the Task prototype.
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
 * Constructs a new `Task[a, _]` containing the single fail value `a`.
 *
 * `a` can be any value, including `null`, `undefined`, or another
 * `Task[a, b]` structure.
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: a → Task[a, _]
 *
 * @param {*} fail
 * @return {Task}
 */
Task.fail = function task$fail(fail) {
  return new Task((sendFail) => {
    sendFail(fail);
  });
};

Task.prototype.fail = Task.fail;


/**
 * Returns an Task that will never resolve
 *
 * Exposed as both a static function and a method on the Task prototype.
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

/**
 * Task's optional type checking
 */

function isTask(m) {
  return (m instanceof Task) || (Boolean(m) && m['@@type'] === TYPEOF_TASK);
}

function isFunction(f) {
  return typeof f === 'function';
}

function error$invalidArg(method, order, expected, param) {
  throw new TypeError(`Task$${method} expects the ${order} argument to be a ${expected}. Got a ${typeof param}`);
}

const methods = {
  create(method, params) {
    if (!isFunction(params[0])) error$invalidArg(method, 'first', 'function', params[0]);
  },
  run(method, params) {
    if (!isFunction(params[0])) error$invalidArg(method, 'first', 'function', params[0]);
    if (!isFunction(params[1])) error$invalidArg(method, 'second', 'function', params[1]);
  },
  map(method, params) {
    if (!isFunction(params[0])) error$invalidArg(method, 'first', 'function', params[0]);
    if (!isTask(params[1])) error$invalidArg(method, 'second', 'Task', params[1]);
  },
  bimap(method, params) {
    if (!isFunction(params[0])) error$invalidArg(method, 'first', 'function', params[0]);
    if (!isFunction(params[1])) error$invalidArg(method, 'second', 'function', params[1]);
    if (!isTask(params[2])) error$invalidArg(method, 'third', 'Task', params[2]);
  },
  chain(method, params) {
    if (!isFunction(params[0])) error$invalidArg(method, 'first', 'function', params[0]);
    if (!isTask(params[1])) error$invalidArg(method, 'second', 'Task', params[1]);
  },
  bichain(method, params) {
    if (!isFunction(params[0])) error$invalidArg(method, 'first', 'function', params[0]);
    if (!isFunction(params[1])) error$invalidArg(method, 'second', 'function', params[1]);
    if (!isTask(params[2])) error$invalidArg(method, 'third', 'Task', params[2]);
  },
  ap(method, params) {
    if (!isTask(params[0])) error$invalidArg(method, 'first', 'Task', params[0]);
    if (!isTask(params[1])) error$invalidArg(method, 'second', 'Task', params[1]);
  },
  concat(method, params) {
    if (!isTask(params[0])) error$invalidArg(method, 'first', 'Task', params[0]);
    if (!isTask(params[1])) error$invalidArg(method, 'second', 'Task', params[1]);
  },
  cache(method, params) {
    if (!isTask(params[0])) error$invalidArg(method, 'first', 'Task', params[0]);
  },
};

function checkType(method, ...args) {
  methods[method](method, args);
}

/**
 * Enable type checking for Task methods,
 * otherwise checker.check is a noop
 */
Task.checkingOn = function() {
  checker.check = checkType;
};

/**
 * Disable type checking for Task methods.
 * Disabled by default.
 */
Task.checkingOff = function() {
  checker.check = () => {};
};

module.exports = Task;
