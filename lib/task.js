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
 * _Signature_: ((a → b) → c → void) → Task[a, b]
 *
 * @class
 * @param {Function} computation
 * @param {Boolean} unSafe (private)
 */
function Task(computation, safe) {
  this._run = (safe) ? task$safeRun(computation) : task$unSafeRun(computation);
}

function task$unSafeRun(computation) {
  return (sendFail, sendSuccess) =>
    computation(sendFail, sendSuccess) || noop;
}

function task$safeRun(computation) {
  return (sendFail, sendSuccess) => {
    let complete = false;
    const cancel = computation(
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
      if (cancel) cancel();
    };
  };
}

/**
 * Run the computation originally passed when creating the Task.
 *
 * @param {Function} sendFail
 * @param {Function} sendSuccess
 * @return {Function} cancellation
 */
Task.prototype.run = function task$run(sendFail, sendSuccess) {
  return this._run(sendFail, sendSuccess);
};

const TYPEOF_TASK = 'jordalgo/task';
Task.prototype['@@type'] = TYPEOF_TASK;

/**
 * Transforms the success value of the `Task[_, a]` using a regular unary
 * function.
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: ((a → b) → Task[_, a]) → Task[_, b]
 *
 * @param {Function} mapper
 * @return {Task}
 */
Task.prototype.map = function task$map(mapper) {
  const _this = this;
  return new Task(function map$computation(sendFail, sendSuccess) {
    return _this.run(sendFail, success => { sendSuccess(mapper(success)); });
  });
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
 * @return {Task}
 */
Task.prototype.bimap = function task$bimap(mapValueFail, mapValueSuccess) {
  const _this = this;
  return new Task(function bimap$computation(sendFail, sendSuccess) {
    return _this.run(
      fail => { sendFail(mapValueFail(fail)); },
      success => { sendSuccess(mapValueSuccess(success)); }
    );
  });
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
 * @return {Task}
 */
Task.prototype.chain = function task$chain(taskMaker) {
  const _this = this;
  return new Task(function chain$computation(sendFail, sendSuccess) {
    let futureCancel;
    const cancel = _this.run(sendFail, success => {
      futureCancel = taskMaker(success).run(sendFail, sendSuccess);
    });
    return function chain$cancel() {
      cancel();
      if (futureCancel) futureCancel();
    };
  });
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
 * @return {Task}
 */
Task.prototype.bichain = function task$bichain(taskMakerOnFail, taskMakerOnSuccess) {
  const _this = this;
  return new Task(function bichain$computation(sendFail, sendSuccess) {
    let futureCancel;
    const cancel = _this.run(
      fail => {
        futureCancel = taskMakerOnFail(fail).run(sendFail, sendSuccess);
      },
      success => {
        futureCancel = taskMakerOnSuccess(success).run(sendFail, sendSuccess);
      }
    );
    return function bichain$cancel() {
      cancel();
      if (futureCancel) futureCancel();
    };
  });
};

/**
 * Applys the success value of the `Task[_, (b → c)]` to the success
 * value of the `Task[d, b]`. Fails with the first failure
 * and throws the second away if it occurs.
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: (Task[d, b] → Task[_, (b → c)]) → Task[_, c]
 *
 * @param {Task} taskValue
 * @return {Task}
 */
Task.prototype.ap = function task$ap(taskValue) {
  const _this = this;
  return new Task(function ap$computation(sendFail, sendSuccess) {
    let failed;
    let succeeded;
    let valueSuccess;
    let functionSuccess;

    function onFail(fail) {
      if (failed) return;
      failed = true;
      sendFail(fail);
    }

    const cancelValue = taskValue.run(onFail, success => {
      if (succeeded) {
        sendSuccess(functionSuccess(success));
      } else {
        succeeded = true;
        valueSuccess = success;
      }
    });

    const cancelFunction = _this.run(onFail, success => {
      if (succeeded) {
        sendSuccess(success(valueSuccess));
      } else {
        succeeded = true;
        functionSuccess = success;
      }
    });

    return function ap$cancel() {
      cancelValue();
      cancelFunction();
    };
  });
};

/**
 * Take the earlier of the two Tasks
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: (Task[a, b] → Task[a → b)]) → Task[a, b]
 *
 * @param {Task} taskA
 * @return {Task}
 */
Task.prototype.concat = function task$concat(taskA) {
  const _this = this;
  return new Task(function concat$computation(sendFail, sendSuccess) {
    let oneFinished;

    function onFail(fail) {
      if (oneFinished) return;
      oneFinished = true;
      sendFail(fail);
    }

    function onSuccess(success) {
      if (oneFinished) return;
      oneFinished = true;
      sendSuccess(success);
    }

    const cancelA = taskA.run(onFail, onSuccess);
    const cancelB = _this.run(onFail, onSuccess);
    return function concat$cancel() {
      cancelA();
      cancelB();
    };
  });
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
 * @return {Task}
 */
Task.prototype.cache = function _task$cache() {
  let compCalled = false;
  let taskComplete = false;
  let futureFail;
  let futureSuccess;
  let successSubs = [];
  let failSubs = [];
  let cancelFn;
  const _this = this;
  return new Task(function cache$computation(sendFail, sendSuccess) {
    if (compCalled && taskComplete) {
      if (taskComplete === 'fail') {
        sendFail(futureFail);
      } else {
        sendSuccess(futureSuccess);
      }
      return noop;
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
    return _this.run(
      fail => {
        taskComplete = 'fail';
        futureFail = fail;
        failSubs.forEach(sub => {
          sub(fail);
        });
        failSubs = [];
      },
      success => {
        taskComplete = 'success';
        futureSuccess = success;
        successSubs.forEach(sub => {
          sub(success);
        });
        successSubs = [];
      }
    );
  });
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
Task.prototype.of = function task$of(success) {
  return new Task((_, sendSuccess) => {
    sendSuccess(success);
  });
};

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
Task.prototype.fail = function task$fail(fail) {
  return new Task((sendFail) => {
    sendFail(fail);
  });
};


/**
 * Returns an Task that will never resolve
 *
 * Exposed as both a static function and a method on the Task prototype.
 *
 * _Signature_: Void → Task[_, _]
 *
 * @return {Task}
 */
Task.prototype.empty = function task$empty() {
  return new Task(() => {});
};


Task.prototype.toString = function task$toString() {
  return 'Task';
};

/**
 * Alias for `run`.
 */
Task.prototype.fork = Task.prototype.run;

/**
 * Callback style run which passes fail and success
 * as the first and second arguments.
 * Use of this function is not advised as fail values are allowed to be null
 * though you probably shouldn't be indicating a fail with null :)
 *
 * _Signature_: (a, b) → (_ → void)
 *
 * @param {Function} callback
 * @return {Function} cancel
 */
Task.prototype.callback = function task$callback(callback) {
  return this.run(
    fail => {
      callback(fail);
    },
    success => {
      callback(null, success);
    }
  );
};

/**
 * Creates a task that sends a success if it receives a fail
 * and passes on the value if it receives a success.
 *
 * _Signature_: a → Task[_, a]
 *
 * @param {*} else
 * @return {Task}
 */
Task.prototype.orElse = function task$orElse(elseValue) {
  const _this = this;
  return new Task(function orElse$computation(sendFail, sendSuccess) {
    return _this.run(
      () => {
        sendSuccess(elseValue);
      },
      sendSuccess
    );
  });
};

/**
 * Exported Factory function for Tasks.
 * Also includes many utility methods.
 *
 * @param {Function} computation
 * @return {Task}
 */
function TaskMaker(computation) {
  return new Task(computation, true);
}

TaskMaker.chain = createUnaryDispatcher('chain');
TaskMaker.bichain = createBinaryDispatcher('bichain');
TaskMaker.map = createUnaryDispatcher('map');
TaskMaker.bimap = createBinaryDispatcher('bimap');
TaskMaker.ap = createUnaryDispatcher('ap');
TaskMaker.concat = createUnaryDispatcher('concat');
TaskMaker.cache = createNullaryDispatcher('cache');
TaskMaker.orElse = createUnaryDispatcher('orElse');
TaskMaker.of = Task.prototype.of;
TaskMaker.fail = Task.prototype.fail;
TaskMaker.empty = Task.prototype.empty;

/**
 * Creates a Task that sends a success after x milliseconds
 *
 * @param {Number} ms
 * @param {*} success
 * @return {Task}
 */
TaskMaker.after = function taskmaker$after(ms, success) {
  return new Task(function after$computation(sendFail, sendSuccess) {
    const id = setTimeout(() => {
      sendSuccess(success);
    }, ms);
    return function after$cancel() {
      clearTimeout(id);
    };
  });
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
TaskMaker.all = function taskmaker$all(taskArray) {
  let successs = [];
  let cancels = [];
  let compCalled = false;

  function cleanUp() {
    cancels = [];
    successs = [];
    compCalled = true;
  }

  return new Task(function all$computation(sendFail, sendSuccess) {
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

// Utility Functions
function noop() {}

function createNullaryDispatcher(method) {
  return function nullaryDispatch(m) {
    if (m && typeof m[method] === 'function') return m[method]();
  };
}

function createUnaryDispatcher(method) {
  return function unaryDispatch(a, m) {
    if (arguments.length === 1) return unaryPartial(unaryDispatch, a);
    if (m && typeof m[method] === 'function') return m[method](a);
  };
}

function createBinaryDispatcher(method) {
  return function binaryDispatch(a, b, m) {
    if (arguments.length === 1) return unaryPartial(binaryDispatch, a);
    if (arguments.length === 2) return binaryPartial(binaryDispatch, a, b);
    if (m && typeof m[method] === 'function') return m[method](a, b);
  };
}

function unaryPartial(f, a) {
  return function partial(b, c, d) {
    switch (arguments.length) {
      case 1: return f(a, b);
      case 2: return f(a, b, c);
      default: return f(a, b, c, d);
    }
  };
}

function binaryPartial(f, a, b) {
  return function partial(c, d) {
    return arguments.length === 1 ? f(a, b, c) : f(a, b, c, d);
  };
}

module.exports = TaskMaker;
