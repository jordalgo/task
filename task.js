(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.task = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Task = require('./task');
module.exports = Task;

},{"./task":2}],2:[function(require,module,exports){
'use strict';

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

function task$run(computation, sendFail, sendSuccess) {
  var complete = false;
  var cancel = computation(function task$SendFail(val) {
    if (complete) return;
    complete = true;
    sendFail(val);
  }, function task$SendSuccess(val) {
    if (complete) return;
    complete = true;
    sendSuccess(val);
  });
  return function task$Cancel() {
    if (complete) return;
    complete = true;
    if (typeof cancel === 'function') {
      cancel();
    }
  };
}

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
  return new Task(function (sendFail, sendSuccess) {
    return task.run(sendFail, function (success) {
      sendSuccess(mapper(success));
    });
  });
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
 * @param {Function} mavalueFail
 * @param {Function} mavalueSuccess
 * @param {Task} task (pre-populated if using the prototype method)
 * @return {Task}
 */
Task.bimap = function task$bimap(mavalueFail, mavalueSuccess, task) {
  return new Task(function (sendFail, sendSuccess) {
    return task.run(function (fail) {
      sendFail(mavalueFail(fail));
    }, function (success) {
      sendSuccess(mavalueSuccess(success));
    });
  });
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
  return new Task(function (sendFail, sendSuccess) {
    var futureCancel = void 0;
    var cancel = task.run(sendFail, function (success) {
      futureCancel = taskMaker(success).run(sendFail, sendSuccess);
    });
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
  return new Task(function (sendFail, sendSuccess) {
    var futureCancel = void 0;
    var cancel = task.run(function (fail) {
      futureCancel = taskMakerOnFail(fail).run(sendFail, sendSuccess);
    }, function (success) {
      futureCancel = taskMakerOnSuccess(success).run(sendFail, sendSuccess);
    });
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
  var valueSuccess = void 0;
  var valueFail = void 0;
  var functionSuccess = void 0;
  var functionFail = void 0;
  var completed = void 0;

  function runApply(sendFail, sendSuccess) {
    if (sendFail) {
      sendFail(functionFail || valueFail);
    } else {
      sendSuccess(functionSuccess(valueSuccess));
    }
  }

  return new Task(function (sendFail, sendSuccess) {
    taskValue.run(function (fail) {
      valueFail = fail;
      if (completed) {
        runApply(sendFail, null);
      } else {
        completed = true;
      }
    }, function (success) {
      valueSuccess = success;
      if (completed) {
        runApply(null, sendSuccess);
      } else {
        completed = true;
      }
    });
    return taskFunction.run(function (fail) {
      functionFail = fail;
      if (completed) {
        runApply(sendFail, null);
      } else {
        completed = true;
      }
    }, function (success) {
      functionSuccess = success;
      if (completed) {
        runApply(null, sendSuccess);
      } else {
        completed = true;
      }
    });
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
  var oneFinished = void 0;
  var cancelA = void 0;
  var cancelB = void 0;
  return new Task(function (sendFail, sendSuccess) {
    cancelA = taskA.run(function (fail) {
      if (oneFinished) return;
      oneFinished = true;
      cancelB();
      sendFail(fail);
    }, function (success) {
      if (oneFinished) return;
      oneFinished = true;
      cancelB();
      sendSuccess(success);
    });
    cancelB = taskB.run(function (fail) {
      if (oneFinished) return;
      oneFinished = true;
      cancelA();
      sendFail(fail);
    }, function (success) {
      if (oneFinished) return;
      oneFinished = true;
      cancelA();
      sendSuccess(success);
    });
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
  var compCalled = false;
  var runReturned = false;
  var futureFail = void 0;
  var futureSuccess = void 0;
  var successSubs = [];
  var failSubs = [];
  var cancelFn = void 0;
  return new Task(function (sendFail, sendSuccess) {
    if (compCalled && runReturned) {
      if (runReturned === 'fail') {
        sendFail(futureFail);
      } else {
        sendSuccess(futureSuccess);
      }
      return function () {};
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
    return task.run(function (fail) {
      runReturned = 'fail';
      futureFail = fail;
      failSubs.forEach(function (sub) {
        sub(fail);
      });
      failSubs = [];
    }, function (success) {
      runReturned = 'success';
      futureSuccess = success;
      successSubs.forEach(function (sub) {
        sub(success);
      });
      successSubs = [];
    });
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
  return new Task(function (sendFail, sendSuccess) {
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
  return new Task(function (sendFail) {
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
  return new Task(function () {});
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
  var successs = [];
  var cancels = [];
  var compCalled = false;

  function cleanUp() {
    cancels = [];
    successs = [];
    compCalled = true;
  }

  return new Task(function (sendFail, sendSuccess) {
    taskArray.forEach(function (a) {
      var cancel = a.run(function (f) {
        if (compCalled) return;
        cancels.forEach(function (c) {
          c();
        });
        sendFail(f);
        cleanUp();
      }, function (s) {
        if (compCalled) return;
        successs.push(s);
        if (successs.length === taskArray.length) {
          sendSuccess(successs);
          cleanUp();
        }
      });
      cancels.push(cancel);
      return function task$all$cancel() {
        cancels.forEach(function (c) {
          c();
        });
      };
    });
  });
};

module.exports = Task;

},{}]},{},[1])(1)
});