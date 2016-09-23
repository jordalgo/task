const assert = require('assert');
const TaskMaker = require('../lib');

const add1 = function(x) { return x + 1; };
const noop = () => {};

describe('Task', () => {
  describe('basic', () => {
    it('only runs the computation when run is called', (done) => {
      let compCalled;
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        setTimeout(() => {
          compCalled = true;
          sendSuccess(1);
        }, 0);
      });

      assert.ok(!compCalled);
      askMe.run(noop, success => {
        assert.equal(success, 1);
        done();
      });
    });

    it('does not catch errors', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        setTimeout(() => {
          try {
            sendSuccess('boom');
          } catch (e) {
            // the message would be "fail called" if it caught the error
            // and sent it down the fail path
            assert.equal(e.message, 'boom');
            done();
          }
        }, 0);
      });

      askMe.run(
        () => {
          assert.sendFail('fail called');
        },
        () => {
          throw new Error('boom');
        }
      );
    });

    it('does not allow a computation to complete twice', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(1);
        setTimeout(() => {
          sendFail('boom');
        }, 0);
      });

      askMe.run(
        () => {
          assert.sendFail('fail called');
        },
        success => {
          assert.equal(success, 1);
        }
      );

      setTimeout(() => {
        done();
      }, 50);
    });

    it('run returns a cancellation function', (done) => {
      let compCalled;
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        const to = setTimeout(() => {
          compCalled = true;
          sendSuccess(1);
        }, 0);
        return () => { clearTimeout(to); };
      });

      const cancel = askMe.run(noop, () => {
        assert.sendFail('Run success sub called');
      });

      cancel();
      setTimeout(() => {
        assert.ok(!compCalled);
        done();
      }, 50);
    });

    it('wont fail or succeed if canceled before', (done) => {
      const askMe = TaskMaker((sendFail) => {
        setTimeout(() => {
          sendFail('boom');
        }, 0);
      });

      const cancel = askMe.run(
        () => {
          assert.sendFail('Fail called');
        },
        () => {
          assert.sendFail('Success called');
        }
      );

      cancel();

      setTimeout(() => {
        done();
      }, 50);
    });
  });

  describe('map', () => {
    it('maps', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(1);
      });

      askMe
      .map(add1)
      .run(noop, success => {
        assert.equal(success, 2);
        done();
      });
    });

    it('does not map fails', (done) => {
      const askMe = TaskMaker((sendFail) => {
        sendFail('boom');
      });

      askMe
      .map(add1)
      .run(
        fail => {
          assert.equal(fail, 'boom');
          done();
        },
        () => { assert.sendFail(); }
      );
    });

    it('run returns the original cancel', (done) => {
      let compCalled;
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        const to = setTimeout(() => {
          compCalled = true;
          sendSuccess(1);
        }, 0);
        return () => { clearTimeout(to); };
      });

      const mappedTask = askMe.map(add1);

      const cancel = mappedTask.run(noop, () => {
        assert.sendFail('Run success sub called');
      });

      cancel();
      setTimeout(() => {
        assert.ok(!compCalled);
        done();
      }, 50);
    });

    it('is exposed as a static function', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(1);
      });

      TaskMaker
      .map(add1, askMe)
      .run(noop, success => {
        assert.equal(success, 2);
        done();
      });
    });
  });

  describe('bichain', () => {
    it('chains for both fail and success', (done) => {
      const askMe = TaskMaker((sendFail) => {
        sendFail(2);
      });

      function askAddfail(l) {
        return TaskMaker((sendFail) => {
          sendFail(l - 1);
        });
      }

      function askAddsuccess(r) {
        return TaskMaker((sendFail, sendSuccess) => {
          sendSuccess(r + 10);
        });
      }

      askMe
      .bichain(askAddfail, askAddsuccess)
      .run(
        l => {
          assert.equal(l, 1);
          done();
        },
        () => {
          assert.sendFail('success got called');
        }
      );
    });

    it('will recursively cancel', (done) => {
      let firstTaskComplete;
      let secondTaskCanceled;
      const askMe = TaskMaker((sendFail) => {
        setTimeout(() => {
          firstTaskComplete = true;
          sendFail(1);
        }, 50);
      });

      function askAdd(l) {
        return TaskMaker((sendFail, sendSuccess) => {
          const id = setTimeout(() => {
            sendSuccess(l + 5);
          }, 100);
          return () => {
            secondTaskCanceled = true;
            clearTimeout(id);
          };
        });
      }

      const cancel = askMe
      .bichain(askAdd, noop)
      .run(
        noop,
        assert.fail.bind(assert, 'success called')
      );

      setTimeout(() => {
        assert.ok(firstTaskComplete);
        cancel();
        setTimeout(() => {
          assert.ok(secondTaskCanceled);
          done();
        }, 250);
      }, 100);
    });

    it('is exposed as a static factory', (done) => {
      const askMe = TaskMaker((sendFail) => {
        sendFail(2);
      });

      function askAddfail(l) {
        return TaskMaker((sendFail) => {
          sendFail(l - 1);
        });
      }

      function askAddsuccess(r) {
        return TaskMaker((sendFail, sendSuccess) => {
          sendSuccess(r + 10);
        });
      }

      TaskMaker
      .bichain(askAddfail, askAddsuccess, askMe)
      .run(
        l => {
          assert.equal(l, 1);
          done();
        },
        () => {
          assert.sendFail('success got called');
        }
      );
    });
  });

  describe('chain', () => {
    it('chains', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(1);
      });

      function askAdd(r) {
        return TaskMaker((sendFail, sendSuccess) => {
          sendSuccess(r + 5);
        });
      }

      askMe
      .chain(askAdd)
      .run(noop, success => {
        assert.equal(success, 6);
        done();
      });
    });

    it('does not call the chaining ask on fail', (done) => {
      let askAddCalled;
      const askMe = TaskMaker((sendFail) => {
        sendFail('boom');
      });

      function askAdd(r) {
        askAddCalled = true;
        return TaskMaker((sendFail, sendSuccess) => {
          sendSuccess(r + 5);
        });
      }

      askMe
      .chain(askAdd)
      .run(
        fail => {
          assert.equal(fail, 'boom');
          assert.ok(!askAddCalled);
          done();
        },
        () => {
          assert.sendFail('success got called');
        }
      );
    });

    it('will recursively cancel', (done) => {
      let firstTaskComplete;
      let secondTaskCanceled;
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        setTimeout(() => {
          firstTaskComplete = true;
          sendSuccess(1);
        }, 50);
      });

      function askAdd(r) {
        return TaskMaker((sendFail, sendSuccess) => {
          const id = setTimeout(() => {
            sendSuccess(r + 5);
          }, 100);
          return () => {
            secondTaskCanceled = true;
            clearTimeout(id);
          };
        });
      }

      const cancel = askMe
      .chain(askAdd)
      .run(
        noop,
        assert.fail.bind(assert, 'success called')
      );

      setTimeout(() => {
        assert.ok(firstTaskComplete);
        cancel();
        setTimeout(() => {
          assert.ok(secondTaskCanceled);
          done();
        }, 250);
      }, 100);
    });

    it('is exposed as a static function', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(1);
      });

      function askAdd(r) {
        return TaskMaker((sendFail, sendSuccess) => {
          sendSuccess(r + 5);
        });
      }

      TaskMaker
      .chain(askAdd, askMe)
      .run(noop, success => {
        assert.equal(success, 6);
        done();
      });
    });
  });

  describe('ap', () => {
    it('applies first success to passed asks right', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        setTimeout(() => {
          sendSuccess(add1);
        }, 10);
      });

      const askYou = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(5);
      });

      askMe
      .ap(askYou)
      .run(noop, success => {
        assert.equal(success, 6);
        done();
      });
    });

    it('is exposed as a static function', (done) => {
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        setTimeout(() => {
          sendSuccess(add1);
        }, 10);
      });

      const askYou = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(5);
      });

      TaskMaker
      .ap(askYou, askMe)
      .run(noop, success => {
        assert.equal(success, 6);
        done();
      });
    });
  });

  describe('concat', () => {
    it('returns the first ask that completes', (done) => {
      function createTask(to, r) {
        return TaskMaker((sendFail, sendSuccess) => {
          const id = setTimeout(() => {
            sendSuccess(r);
          }, to);
          return () => {
            clearTimeout(id);
          };
        });
      }

      createTask(100, 5)
      .concat(createTask(50, 3))
      .run(noop, success => {
        assert.equal(success, 3);
        done();
      });
    });

    it('run returns a function that can cancel both', (done) => {
      let cancelCalled = 0;
      function createTask(to, r) {
        return TaskMaker((sendFail, sendSuccess) => {
          const id = setTimeout(() => {
            sendSuccess(r);
          }, to);
          return () => {
            cancelCalled++;
            clearTimeout(id);
          };
        });
      }

      const cancelBoth = createTask(100, 5)
      .concat(createTask(50, 3))
      .run(noop, () => {
        assert.sendFail('message called');
      });

      cancelBoth();

      setTimeout(() => {
        assert.equal(cancelCalled, 2);
        done();
      }, 150);
    });

    it('is exposed as a static function', (done) => {
      function createTask(to, r) {
        return TaskMaker((sendFail, sendSuccess) => {
          const id = setTimeout(() => {
            sendSuccess(r);
          }, to);
          return () => {
            clearTimeout(id);
          };
        });
      }

      TaskMaker
      .concat(createTask(50, 3), createTask(100, 5))
      .run(noop, success => {
        assert.equal(success, 3);
        done();
      });
    });
  });

  describe('cache', () => {
    it('run returns the original value and does not re-run computation', (done) => {
      let called = 0;
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(1);
        called++;
      });

      const askMeMemo = askMe.cache();

      askMeMemo.run(noop, success => {
        assert.equal(success, 1);
      });

      let secondCall = false;

      setTimeout(() => {
        askMeMemo.run(noop, success => {
          secondCall = true;
          assert.equal(called, 1);
          assert.equal(success, 1);
          done();
        });
        // make sure the second run is also always async
        assert.ok(!secondCall);
      }, 50);
    });

    it('notifies each run observer if the computation has not completed', (done) => {
      let called = 0;
      let runCalled = 0;
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        setTimeout(() => {
          sendSuccess(1);
        }, 0);
        called++;
      });

      const askMeMemo = askMe.cache();

      askMeMemo.run(noop, success => {
        assert.equal(success, 1);
        runCalled++;
      });

      askMeMemo.run(noop, success => {
        assert.equal(success, 1);
        assert.equal(runCalled, 1);
        assert.equal(called, 1);
        done();
      });
    });

    it('is exposed as a static function', (done) => {
      let called = 0;
      const askMe = TaskMaker((sendFail, sendSuccess) => {
        sendSuccess(1);
        called++;
      });

      const askMeMemo = TaskMaker.cache(askMe);

      askMeMemo.run(noop, success => {
        assert.equal(success, 1);
      });

      let secondCall = false;

      setTimeout(() => {
        askMeMemo.run(noop, success => {
          secondCall = true;
          assert.equal(called, 1);
          assert.equal(success, 1);
          done();
        });
        // make sure the second run is also always async
        assert.ok(!secondCall);
      }, 0);
    });
  });

  describe('after', () => {
    it('sends a success after x milliseconds', (done) => {
      let waited;
      TaskMaker.after(50, 'hello')
      .run(() => {
        assert.fail('fail called');
      },
      (success) => {
        waited = true;
        assert.equal(success, 'hello');
        done();
      });
      assert.ok(!waited);
    });
  });

  describe('callback', () => {
    it('runs the computation and passes fail as the first arg', () => {
      TaskMaker.fail('boom')
      .callback((fail, success) => {
        assert.equal(fail, 'boom');
        assert.ok(!success);
      });
    });

    it('runs the computation and passes success as the second arg', () => {
      TaskMaker.of('hello')
      .callback((fail, success) => {
        assert.ok(!fail);
        assert.equal(success, 'hello');
      });
    });
  });

  describe('orElse', () => {
    it('forwards the success value', () => {
      TaskMaker.of('hello')
      .orElse('bye')
      .run(
        () => { assert.fail('fail called'); },
        success => { assert.equal(success, 'hello'); }
      );
    });

    it('forwards the else value on fail', () => {
      TaskMaker.fail('boom')
      .orElse('bye')
      .run(
        () => { assert.fail('fail called'); },
        success => { assert.equal(success, 'bye'); }
      );
    });

    it('is exposed as a static function', () => {
      const failure = TaskMaker.fail('boom');
      TaskMaker.orElse('bye', failure)
      .run(
        () => { assert.fail('fail called'); },
          success => { assert.equal(success, 'bye'); }
      );
    });
  });

  describe('all', () => {
    it('does not notify until all Tasks are completed', (done) => {
      let count = 0;
      function createTask(to) {
        const order = ++count;
        return TaskMaker((sendFail, sendSuccess) => {
          setTimeout(() => {
            sendSuccess(order);
          }, to);
        });
      }

      TaskMaker.all([
        createTask(100),
        createTask(500),
        createTask(0),
      ]).run(noop, success => {
        assert.equal(count, 3);
        assert.deepEqual(success, [3, 1, 2]);
        done();
      });
    });

    it('sends the first fail and cancels other asks if a left occurs', (done) => {
      function createTask(to, l) {
        return TaskMaker((sendFail) => {
          const id = setTimeout(() => {
            if (!l) {
              assert.sendFail('Should have been canceled');
            } else {
              sendFail(l);
            }
          }, to);
          return () => {
            clearTimeout(id);
          };
        });
      }

      TaskMaker.all([
        createTask(50),
        createTask(51),
        createTask(0, 'boom'),
      ]).run(
        fail => {
          assert.equal(fail, 'boom');
          done();
        },
        () => {
          assert.sendFail('success was called');
        }
      );
    });

    it('wont throw even if proper cancel functions not returned', (done) => {
      function createTask(to, l) {
        return TaskMaker((sendFail, sendSuccess) => {
          setTimeout(() => {
            if (!l) {
              sendSuccess('uh oh');
            } else {
              sendFail(l);
            }
          }, to);
        });
      }

      let callCount = 0;

      TaskMaker.all([
        createTask(50, 'boom'),
        createTask(70),
        createTask(0),
      ]).run(
        fail => {
          callCount++;
          assert.equal(fail, 'boom');
        },
        () => {
          callCount++;
        }
      );

      setTimeout(() => {
        assert.equal(callCount, 1);
        done();
      }, 100);
    });
  });
});

