(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ask = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
    var compCalled = false;
    function wrapped(fn) {
      return function (val) {
        if (compCalled) {
          throw new Error('Ask computations can call either left or right, not both.');
        }
        compCalled = true;
        delayed(function () {
          fn(val);
        });
      };
    }
    var compCancel = computation(wrapped(leftSub), wrapped(rightSub));
    return typeof compCancel === 'function' ? compCancel : function () {};
  };
}

/**
 * Transforms the right value of the `Ask[l, a]` using a regular unary
 * function.
 *
 * @summary ((a → b) → Ask[l, a]) → Ask[l, b]
 */
Ask.map = function map(fn, ask) {
  return new Ask(function (left, right) {
    return ask.run(left, function (x) {
      right(fn(x));
    });
  });
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
  return new Ask(function (left, right) {
    return ask.run(function (a) {
      left(fnLeft(a));
    }, function (b) {
      right(fnRight(b));
    });
  });
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
  return new Ask(function (left, right) {
    return ask.run(left, function (r) {
      fn(r).run(left, right);
    });
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
  return new Ask(function (left, right) {
    return ask.run(function (l) {
      fnLeft(l).run(left, right);
    }, function (r) {
      fnRight(r).run(left, right);
    });
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
  var pRight = void 0;
  var pLeft = void 0;
  var zRight = void 0;
  var zLeft = void 0;
  var completed = void 0;

  function runApply(left, right) {
    if (left) {
      left(zLeft || pLeft);
    } else {
      right(zRight(pRight));
    }
  }

  return new Ask(function (left, right) {
    askP.run(function (lP) {
      pLeft = lP;
      if (completed) {
        runApply(left, null);
      } else {
        completed = true;
      }
    }, function (rP) {
      pRight = rP;
      if (completed) {
        runApply(null, right);
      } else {
        completed = true;
      }
    });
    return askZ.run(function (lZ) {
      zLeft = lZ;
      if (completed) {
        runApply(left, null);
      } else {
        completed = true;
      }
    }, function (zP) {
      zRight = zP;
      if (completed) {
        runApply(null, right);
      } else {
        completed = true;
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
 * @summary (Ask[a, b] → Ask[a → b)]) → Ask[a, b]
 */
Ask.concat = function concat(askA, askB) {
  var oneFinished = void 0;
  var cancelA = void 0;
  var cancelB = void 0;
  return new Ask(function (left, right) {
    cancelA = askA.run(function (lA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelB();
      left(lA);
    }, function (rA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelB();
      right(rA);
    });
    cancelB = askB.run(function (lA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelA();
      left(lA);
    }, function (rA) {
      if (oneFinished) return;
      oneFinished = true;
      cancelA();
      right(rA);
    });
    // cancel both
    return function () {
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
  var compCalled = false;
  var runReturned = false;
  var futureLeft = void 0;
  var futureRight = void 0;
  var rightSubs = [];
  var leftSubs = [];
  var cancelFn = void 0;
  return new Ask(function (left, right) {
    if (compCalled && runReturned) {
      if (runReturned === 'left') {
        left(futureLeft);
      } else {
        right(futureRight);
      }
      return function () {};
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
    return ask.run(function (l) {
      runReturned = 'left';
      futureLeft = l;
      leftSubs.forEach(function (sub) {
        sub(l);
      });
      delayed(function () {
        leftSubs = [];
      });
    }, function (r) {
      runReturned = 'right';
      futureRight = r;
      rightSubs.forEach(function (sub) {
        sub(r);
      });
      delayed(function () {
        rightSubs = [];
      });
    });
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
  return new Ask(function (left, right) {
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
  return new Ask(function (left) {
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
  return new Ask(function () {});
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
Ask.all = function (askArray) {
  var rights = [];
  var cancels = [];
  var compCalled = false;

  function cleanUp() {
    cancels = [];
    rights = [];
    compCalled = true;
  }

  return new Ask(function (left, right) {
    askArray.forEach(function (a) {
      var cancel = a.run(function (l) {
        if (compCalled) return;
        cancels.forEach(function (c) {
          c();
        });
        left(l);
        cleanUp();
      }, function (r) {
        if (compCalled) return;
        rights.push(r);
        if (rights.length === askArray.length) {
          right(rights);
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

module.exports = Ask;

}).call(this,require('_process'))
},{"_process":3}],2:[function(require,module,exports){
'use strict';

var Ask = require('./ask');
module.exports = Ask;

},{"./ask":1}],3:[function(require,module,exports){
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

},{}]},{},[2])(2)
});
