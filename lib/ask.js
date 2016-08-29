var addMethods = require('./ask-methods');
var delayed = require('./delayed');

function Ask(computation) {
  var cancel = () => {};
  this.run = function run(observer) {
    var compCalled = false;
    var compCancel = computation(function(left, right) {
      if (compCalled) {
        throw new Error('Ask computation can only be called once e.g. there can be either a left or a right. Not both at different times.');
      }
      compCalled = true;
      delayed(function() {
        observer(left, right);
      });
    });

    return (typeof compCancel === 'function') ? compCancel : cancel;
  };
}

Ask.prototype.create = function create(computation) {
  return new Ask(computation);
}

Ask.create = Ask.prototype.create;

Ask.prototype.toString = function toString() {
  return 'Ask';
}

addMethods(Ask.prototype);

// Static Methods
Ask.of = function of(right) {
  return new Ask(message => {
    message(null, right);
  });
};

Ask.ofLeft = function ofLeft(left) {
  return new Ask(message => {
    message(left);
  });
};

module.exports = Ask;
