function Ask(computation) {
  var runCalled = false;
  var futureError;
  var futureSuccess;
  var cancel = () => {};
  this.run = function run(observer) {
    if (runCalled) {
      setTimeout(function() {
        observer(futureError, futureSuccess);
      }, 0);
      return cancel;
    }
    runCalled = true;

    var compCalled = false;
    var compCancel = computation(function(error, success) {
      if (compCalled) {
        throw new Error('Ask computation can only be called once e.g. there can be either an error or a success. Not both.');
      }
      compCalled = true;
      futureError = error;
      futureSuccess = success;
      setTimeout(function() {
        observer(error, success);
      }, 0);
    });

    return (typeof compCancel === 'function') ? compCancel : cancel;
  };
}

Ask.prototype.map = function(fn) {
  var run = this.run;
  return new Ask(message => {
    return run((error, success) => {
      if (error) {
        message(error);
      } else {
        message(null, fn(success));
      }
    });
  });
}

Ask.prototype.chain = function(fn) {
  var run = this.run;
  return new Ask(message => {
    return run((error, success) => {
      return fn(error, success).run(message);
    });
  });
}

module.exports = Ask;
