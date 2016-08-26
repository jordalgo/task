var assert = require('assert');
var Ask = require('../lib');

var add1 = function(x) { return x + 1; };

describe('Ask', function() {
  it('only runs the computation when run is called', (done) => {
    var compCalled;
    var askMe = new Ask(message => {
      setTimeout(() => {
        compCalled = true;
        message(null, 1);
      }, 100);
    });

    assert.ok(!compCalled);
    askMe.run((error, message) => {
      assert.equal(message, 1);
      done();
    });
  });

  it('always executes the observer async', (done) => {
    var compCalled;
    var askMe = new Ask(message => {
      message(null, 1);
    });

    askMe.run((error, message) => {
      compCalled = true;
      assert.equal(message, 1);
    });
    assert.ok(!compCalled);
    setTimeout(done, 100);
  });

  it('run returns the original value and does not re-run computation', (done) => {
    var called = 0;
    var askMe = new Ask(message => {
      message(null, 1);
      called++;
    });

    askMe.run((error, message) => {
      assert.equal(message, 1);
    });

    var secondCall = false;

    setTimeout(() => {
      askMe.run((error, message) => {
        secondCall = true;
        assert.equal(called, 1);
        assert.equal(message, 1);
        done();
      });
      // make sure the second run is also always async
      assert.ok(!secondCall);
    }, 100);
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

    askMe.run((error, message) => {
      assert.equal(message, 1);
    });
  });

  it('run returns a cancellation function', (done) => {
    var compCalled;
    var askMe = new Ask(message => {
      var to = setTimeout(() => {
        compCalled = true;
        message(null, 1);
      }, 1000);
      return () => { clearTimeout(to); };
    });

    var cancel = askMe.run((error, message) => {
      assert.fail('Run Observer should never have been called');
    });

    cancel();
    setTimeout(() => {
      assert.ok(!compCalled);
      done();
    }, 1500);
  });

  describe('map', () => {
    it('maps', (done) => {
      var askMe = new Ask(message => {
        message(null, 1);
      });

      askMe
      .map(x => x + 1)
      .run((error, message) => {
        assert.equal(message, 2);
        done();
      });
    });

    it('does not map error', (done) => {
      var askMe = new Ask(message => {
        message('boom');
      });

      askMe
      .map(x => x + 1)
      .run((error, message) => {
        assert.ok(!message);
        assert.equal(error, 'boom');
        done();
      });
    });

    it('does not re-run the original computation', (done) => {
      var called = 0;
      var askMe = new Ask(message => {
        message(null, 1);
        called++;
      });

      var mappedAsk = askMe.map(x => x + 1);

      mappedAsk.run((error, message) => {
        assert.equal(message, 2);
      });

      setTimeout(() => {
        mappedAsk.run((error, message) => {
          assert.equal(called, 1);
          assert.equal(message, 2);
          done();
        });
      }, 100);
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

      var mappedAsk = askMe.map(x => x + 1);

      var cancel = mappedAsk.run((error, message) => {
        assert.fail('Run Observer should never have been called');
      });

      cancel();
      setTimeout(() => {
        assert.ok(!compCalled);
        done();
      }, 500);
    });
  });

  describe('chain', () => {
    it('chains', (done) => {
      var askMe = new Ask(message => {
        message(null, 1);
      });

      function askAdd(error, success) {
        return new Ask(message => {
          message(error, (success) ? success + 5 : null);
        });
      }

      askMe
      .chain(askAdd)
      .run((error, message) => {
        assert.equal(message, 6);
        done();
      });
    });
  });
});

