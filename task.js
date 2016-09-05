(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.task = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Task = require('./task');
module.exports = Task;

},{"./task":2}],2:[function(require,module,exports){
(function (process){
'use strict';

/**
 * A helper for delaying the execution of a function.
 * Taken from data.task :)
 * @private
 * @summary (Any... -> Any) -> Void
 */
var delayed = setTimeout;
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
    var compCalled = false;
    function wrapped(fn) {
      return function (val) {
        if (compCalled) {
          throw new Error('Task computations can call either sendFail or sendSuccess, not both.');
        }
        compCalled = true;
        delayed(function () {
          fn(val);
        });
      };
    }
    var compCancel = computation(wrapped(failSub), wrapped(successSub));
    return typeof compCancel === 'function' ? compCancel : cancelHolder;
  };
}

/**
 * Transforms the success value of the `Task[l, a]` using a regular unary
 * function.
 *
 * @summary ((a → b) → Task[l, a]) → Ask[l, b]
 */
Task.map = function map(fn, ask) {
  return new Task(function (sendFail, sendSuccess) {
    return ask.run(sendFail, function (success) {
      sendSuccess(fn(success));
    });
  });
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
  return new Task(function (sendFail, sendSuccess) {
    return task.run(function (fail) {
      sendFail(fnFail(fail));
    }, function (success) {
      sendSuccess(fnSuccess(success));
    });
  });
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
  return new Task(function (sendFail, sendSuccess) {
    var futureCancel = function futureCancel() {};
    var cancel = task.run(sendFail, function (success) {
      futureCancel = fn(success).run(sendFail, sendSuccess);
    });
    return function () {
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
  return new Task(function (sendFail, sendSuccess) {
    var futureCancel = function futureCancel() {};
    var cancel = task.run(function (fail) {
      futureCancel = fnFail(fail).run(sendFail, sendSuccess);
    }, function (success) {
      futureCancel = fnSuccess(success).run(sendFail, sendSuccess);
    });
    return function () {
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
  var pSuccess = void 0;
  var pFail = void 0;
  var zSuccess = void 0;
  var zFail = void 0;
  var completed = void 0;

  function runApply(sendFail, sendSuccess) {
    if (sendFail) {
      sendFail(zFail || pFail);
    } else {
      sendSuccess(zSuccess(pSuccess));
    }
  }

  return new Task(function (sendFail, sendSuccess) {
    taskP.run(function (fP) {
      pFail = fP;
      if (completed) {
        runApply(sendFail, null);
      } else {
        completed = true;
      }
    }, function (sP) {
      pSuccess = sP;
      if (completed) {
        runApply(null, sendSuccess);
      } else {
        completed = true;
      }
    });
    return taskZ.run(function (fZ) {
      zFail = fZ;
      if (completed) {
        runApply(sendFail, null);
      } else {
        completed = true;
      }
    }, function (sZ) {
      zSuccess = sZ;
      if (completed) {
        runApply(null, sendSuccess);
      } else {
        completed = true;
      }
    });
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
  var oneFinished = void 0;
  var cancelA = void 0;
  var cancelB = void 0;
  return new Task(function (sendFail, sendSuccess) {
    cancelA = taskA.run(function (lA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelB();
      sendFail(lA);
    }, function (rA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelB();
      sendSuccess(rA);
    });
    cancelB = taskB.run(function (lA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelA();
      sendFail(lA);
    }, function (rA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelA();
      sendSuccess(rA);
    });
    // cancel both
    return function () {
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
    return task.run(function (f) {
      runReturned = 'fail';
      futureFail = f;
      failSubs.forEach(function (sub) {
        sub(f);
      });
      delayed(function () {
        failSubs = [];
      });
    }, function (s) {
      runReturned = 'success';
      futureSuccess = s;
      successSubs.forEach(function (sub) {
        sub(s);
      });
      delayed(function () {
        successSubs = [];
      });
    });
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
  return new Task(function (sendFail, sendSuccess) {
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
  return new Task(function (sendFail) {
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
  return new Task(function () {});
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
Task.all = function (taskArray) {
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
      return function () {
        cancels.forEach(function (c) {
          c();
        });
      };
    });
  });
};

module.exports = Task;

}).call(this,require('_process'))
},{"_process":3}],3:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
    try {
        cachedSetTimeout = setTimeout;
    } catch (e) {
        cachedSetTimeout = function () {
            throw new Error('setTimeout is not defined');
        }
    }
    try {
        cachedClearTimeout = clearTimeout;
    } catch (e) {
        cachedClearTimeout = function () {
            throw new Error('clearTimeout is not defined');
        }
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1])(1)
});