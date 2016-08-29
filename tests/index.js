var assert = require('assert');
var Ask = require('../lib').Ask;
var AskOnce = require('../lib').AskOnce;

var add1 = function(x) { return x + 1; };

function sharedTests(Asker) {
  describe('base', () => {
    it('only runs the computation when run is called', (done) => {
      var compCalled;
      var askMe = new Asker(message => {
        setTimeout(() => {
          compCalled = true;
          message(null, 1);
        }, 100);
      });

      assert.ok(!compCalled);
      askMe.run((left, message) => {
        assert.equal(message, 1);
        done();
      });
    });

    it('always executes the observer async', (done) => {
      var compCalled;
      var askMe = new Ask(message => {
        message(null, 1);
      });

      askMe.run((left, message) => {
        compCalled = true;
        assert.equal(message, 1);
      });
      assert.ok(!compCalled);
      setTimeout(done, 100);
    });

    it('throws if the computation tries to complete twice', (done) => {
      var askMe = new Ask(message => {
        message(null, 1);
        setTimeout(() => {
          try {
            message('boom');
          } catch (e) {
            done();
          }
        }, 100);
      });

      askMe.run((left, message) => {
        assert.equal(message, 1);
      });
    });

    it('run returns a cancellation function', (done) => {
      var compCalled;
      var askMe = new Ask(message => {
        var to = setTimeout(() => {
          compCalled = true;
          message(null, 1);
        }, 500);
        return () => { clearTimeout(to); };
      });

      var cancel = askMe.run((left, message) => {
        assert.fail('Run Observer should never have been called');
      });

      cancel();
      setTimeout(() => {
        assert.ok(!compCalled);
        done();
      }, 100);
    });

  });

  describe('map', () => {
    it('maps', (done) => {
      var askMe = new Ask(message => {
        message(null, 1);
      });

      askMe
      .map(add1)
      .run((left, message) => {
        assert.equal(message, 2);
        done();
      });
    });

    it('does not map left', (done) => {
      var askMe = new Ask(message => {
        message('boom');
      });

      askMe
      .map(add1)
      .run((left, message) => {
        assert.ok(!message);
        assert.equal(left, 'boom');
        done();
      });
    });

    it('run returns the original cancel', (done) => {
      var compCalled;
      var askMe = new Ask(message => {
        var to = setTimeout(() => {
          compCalled = true;
          message(null, 1);
        }, 100);
        return () => { clearTimeout(to); };
      });

      var mappedAsk = askMe.map(add1);

      var cancel = mappedAsk.run((left, message) => {
        assert.fail('Run Observer should never have been called');
      });

      cancel();
      setTimeout(() => {
        assert.ok(!compCalled);
        done();
      }, 150);
    });
  });

  describe('biChain', () => {
    it('chains', (done) => {
      var askMe = new Ask(message => {
        message(null, 1);
      });

      function askAdd(left, right) {
        return new Ask(message => {
          message(left, (right) ? right + 5 : null);
        });
      }

      askMe
      .biChain(askAdd)
      .run((left, message) => {
        assert.equal(message, 6);
        done();
      });
    });

    it('calls the chaining ask on left', (done) => {
      var askAddCalled;
      var askMe = new Ask(message => {
        message('boom');
      });

      function askAdd(left, right) {
        askAddCalled = true;
        return new Ask(message => {
          message(left, (right) ? right + 5 : null);
        });
      }

      askMe
      .biChain(askAdd)
      .run((left, right) => {
        assert.equal(left, 'boom');
        assert.ok(!right);
        assert.ok(askAddCalled);
        done();
      });
    });
  });

  describe('chain', () => {
    it('chains', (done) => {
      var askMe = new Ask(message => {
        message(null, 1);
      });

      function askAdd(right) {
        return new Ask(message => {
          message(null, right + 5);
        });
      }

      askMe
      .chain(askAdd)
      .run((left, right) => {
        assert.equal(right, 6);
        done();
      });
    });

    it('does not call the chaining ask on left', (done) => {
      var askAddCalled;
      var askMe = new Ask(message => {
        message('boom');
      });

      function askAdd(left, right) {
        askAddCalled = false;
        return new Ask(message => {
          message(left, (right) ? right + 5 : null);
        });
      }

      askMe
      .biChain(askAdd)
      .run((left, right) => {
        assert.equal(left, 'boom');
        assert.ok(!right);
        assert.ok(!askAddCalled);
        done();
      });
    });
  });

  describe('ap', () => {
    it('applies first right to passed asks right', (done) => {
      var askMe = new Ask(message => {
        setTimeout(() => {
          message(null, add1);
        }, 10);
      });

      var askYou = new Ask(message => {
        message(null, 5);
      });

      askMe
      .ap(askYou)
      .run((left, right) => {
        assert.equal(right, 6);
        done();
      });
    });
  });
}

describe('Ask', () => {
  sharedTests(Ask);
});

describe('AskOnce', function() {
  describe('base', () => {
    it('run returns the original value and does not re-run computation', (done) => {
      var called = 0;
      var askMe = new AskOnce(message => {
        message(null, 1);
        called++;
      });

      askMe.run((left, message) => {
        assert.equal(message, 1);
      });

      var secondCall = false;

      setTimeout(() => {
        askMe.run((left, message) => {
          secondCall = true;
          assert.equal(called, 1);
          assert.equal(message, 1);
          done();
        });
        // make sure the second run is also always async
        assert.ok(!secondCall);
      }, 100);
    });

    it('notifies each run observer if the computation has not completed', (done) => {
      var called = 0;
      var runCalled = 0;
      var askMe = new AskOnce(message => {
        setTimeout(() => {
          message(null, 1);
        }, 100);
        called++;
      });

      askMe.run((left, message) => {
        assert.equal(message, 1);
        runCalled++;
      });

      askMe.run((left, message) => {
        assert.equal(message, 1);
        assert.equal(runCalled, 1);
        assert.equal(called, 1);
        done();
      });
    });
  });

  describe('map', () => {
    it('does not re-run the original computation', (done) => {
      var called = 0;
      var askMe = new AskOnce(message => {
        message(null, 1);
        called++;
      });

      var mappedAsk = askMe.map(x => x + 1);

      mappedAsk.run((left, message) => {
        assert.equal(message, 2);
      });

      setTimeout(() => {
        mappedAsk.run((left, message) => {
          assert.equal(called, 1);
          assert.equal(message, 2);
          done();
        });
      }, 100);
    });
  });

  sharedTests(AskOnce);
});

