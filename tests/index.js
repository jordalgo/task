const assert = require('assert');
const Task = require('../lib');

const add1 = function(x) { return x + 1; };
const noop = () => {};

describe('Task', () => {
  before(() => {
    // make sure this runs with type checking on
    // no risk in it running while off.
    Task.checkingOn();
  });

  after(() => {
    Task.checkingOff();
  });

  describe('basic', () => {
    it('only runs the computation when run is called', (done) => {
      let compCalled;
      const askMe = new Task((sendFail, sendSuccess) => {
        setTimeout(() => {
          compCalled = true;
          sendSuccess(1);
        }, 100);
      });

      assert.ok(!compCalled);
      askMe.run(noop, success => {
        assert.equal(success, 1);
        done();
      });
    });

    it('does not catch errors', (done) => {
      const askMe = new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail, sendSuccess) => {
        sendSuccess(1);
        setTimeout(() => {
          sendFail('boom');
        }, 100);
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
      }, 150);
    });

    it('run returns a cancellation function', (done) => {
      let compCalled;
      const askMe = new Task((sendFail, sendSuccess) => {
        const to = setTimeout(() => {
          compCalled = true;
          sendSuccess(1);
        }, 500);
        return () => { clearTimeout(to); };
      });

      const cancel = askMe.run(noop, () => {
        assert.sendFail('Run success sub called');
      });

      cancel();
      setTimeout(() => {
        assert.ok(!compCalled);
        done();
      }, 100);
    });

    it('wont fail or succeed if canceled before', (done) => {
      const askMe = new Task((sendFail) => {
        setTimeout(() => {
          sendFail('boom');
        }, 50);
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
      }, 100);
    });
  });

  describe('map', () => {
    it('maps', (done) => {
      const askMe = new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail) => {
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
      const askMe = new Task((sendFail, sendSuccess) => {
        const to = setTimeout(() => {
          compCalled = true;
          sendSuccess(1);
        }, 100);
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
      }, 150);
    });

    it('is exposed as a static function', (done) => {
      const askMe = new Task((sendFail, sendSuccess) => {
        sendSuccess(1);
      });

      Task
      .map(add1, askMe)
      .run(noop, success => {
        assert.equal(success, 2);
        done();
      });
    });
  });

  describe('bichain', () => {
    it('chains for both fail and success', (done) => {
      const askMe = new Task((sendFail) => {
        sendFail(2);
      });

      function askAddfail(l) {
        return new Task((sendFail) => {
          sendFail(l - 1);
        });
      }

      function askAddsuccess(r) {
        return new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail) => {
        setTimeout(() => {
          firstTaskComplete = true;
          sendFail(1);
        }, 50);
      });

      function askAdd(l) {
        return new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail) => {
        sendFail(2);
      });

      function askAddfail(l) {
        return new Task((sendFail) => {
          sendFail(l - 1);
        });
      }

      function askAddsuccess(r) {
        return new Task((sendFail, sendSuccess) => {
          sendSuccess(r + 10);
        });
      }

      Task
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
      const askMe = new Task((sendFail, sendSuccess) => {
        sendSuccess(1);
      });

      function askAdd(r) {
        return new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail) => {
        sendFail('boom');
      });

      function askAdd(r) {
        askAddCalled = true;
        return new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail, sendSuccess) => {
        setTimeout(() => {
          firstTaskComplete = true;
          sendSuccess(1);
        }, 50);
      });

      function askAdd(r) {
        return new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail, sendSuccess) => {
        sendSuccess(1);
      });

      function askAdd(r) {
        return new Task((sendFail, sendSuccess) => {
          sendSuccess(r + 5);
        });
      }

      Task
      .chain(askAdd, askMe)
      .run(noop, success => {
        assert.equal(success, 6);
        done();
      });
    });
  });

  describe('ap', () => {
    it('applies first success to passed asks right', (done) => {
      const askMe = new Task((sendFail, sendSuccess) => {
        setTimeout(() => {
          sendSuccess(add1);
        }, 10);
      });

      const askYou = new Task((sendFail, sendSuccess) => {
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
      const askMe = new Task((sendFail, sendSuccess) => {
        setTimeout(() => {
          sendSuccess(add1);
        }, 10);
      });

      const askYou = new Task((sendFail, sendSuccess) => {
        sendSuccess(5);
      });

      Task
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
        return new Task((sendFail, sendSuccess) => {
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
        return new Task((sendFail, sendSuccess) => {
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
        return new Task((sendFail, sendSuccess) => {
          const id = setTimeout(() => {
            sendSuccess(r);
          }, to);
          return () => {
            clearTimeout(id);
          };
        });
      }

      Task
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
      const askMe = new Task((sendFail, sendSuccess) => {
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
      }, 100);
    });

    it('notifies each run observer if the computation has not completed', (done) => {
      let called = 0;
      let runCalled = 0;
      const askMe = new Task((sendFail, sendSuccess) => {
        setTimeout(() => {
          sendSuccess(1);
        }, 100);
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
      const askMe = new Task((sendFail, sendSuccess) => {
        sendSuccess(1);
        called++;
      });

      const askMeMemo = Task.cache(askMe);

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
      }, 100);
    });
  });

  describe('all', () => {
    it('does not notify until all Tasks are completed', (done) => {
      let count = 0;
      function createTask(to) {
        const order = ++count;
        return new Task((sendFail, sendSuccess) => {
          setTimeout(() => {
            sendSuccess(order);
          }, to);
        });
      }

      Task.all([
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
        return new Task((sendFail) => {
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

      Task.all([
        createTask(100),
        createTask(500),
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
        return new Task((sendFail, sendSuccess) => {
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

      Task.all([
        createTask(100, 'boom'),
        createTask(500),
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
      }, 600);
    });
  });
});

