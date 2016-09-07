# Task

A javascript data type for async requests. Very similar to the [data.task](https://github.com/folktale/data.task) and [fun-task](https://github.com/rpominov/fun-task) with some modifications. Published on NPM as "jordalgo-task"

## Installing
```
npm install jordalgo-task
```

## Quick Details
- The functions passed to run are always called async
- You can't complete a Task more than once e.g. you can't call sendFail and then call sendSuccess (an error will be thrown).
- Functions passed to Task can optionally create a cancel (like above) otherwise cancel will be an no-op.
- It's lazy! The function passed on Task creation is only called when `run` is invoked.
- There is no error catching in this Task implementation. Errors are not thrown or caught from within a Task. There are failure values but these are not the same thing as errors -- think of them as "bad news".

## Table of Contents
- [Simple Example](#simple-example)
- [Chaining](#chaining)
- [Cancelling](#cancelling)
- [Memoization](#memoization)
- [Parallel Tasks](#parallel)
- [Specifications Compatibility](#specifications)
- [How is this Task different than Data.Task or Fun-Task](#different)
- [Credits](#credits)

----------------------

<a name="simple-example"></a>
## Simple Example
```javascript
import Task from 'Task';
const task = new Task((sendFail, sendSuccess) => {
  const id = setTimeout(() => {
    sendSuccess(1);
  }, 1000);
  return () => { clearTimeout(id); };
});

const cancel = task.run(
  fail => {
    // never called;
  },
  success => {
    // success === 1
  }
);
```

<a name="chaining"></a>
## Chaining
A chained Task waits for the first Task to finish successfully before the subsequent ones are run. If a previous Task in a chain fails then subsequent Tasks will not be run and will continue down the chain. If you would rather still call the Task producing functions on a Task failure use `bichain`, which will pass along failures to a Task producing function.

```javascript
function getUser(id) {
  return new Task((sendFail, sendSuccess) => {
    // AJAX request to get a user with id
    sendSuccess({ user });
  });
}

// will only get called in the chain below if getUser sends a success.
function getFollowers(username) {
  return new Task((sendFail, sendSuccess) => {
    // AJAX request using username
    success([followers]);
  });
}

getUser()
.map(user => user.name)
.chain(getFollowers)
.run(
  fail => {},
  success => {
    // success === [followers] (if all went well)
  }
});
```

<a name="cancelling"></a>
## Cancelling
Cancellation functions are great if you have a need to cancel an async action that hasn't completed yet. Cancel functions are provided by the computation passed in when creating a Task.

```javascript
function requestData() {
  return new Ask((sendFail, sendSuccess) => {
    const request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status === 200) {
          var response = JSON.parse(request.response);
          sendSuccess(response);
        } else {
          sendFail('Could not fetch data: ' + request.status);
        }
      }
    };
    request.open('GET', 'http:///my-endpoint');
    request.send();
    // the cancellation function
    return () => { request.abort(); }
  });
}

const cancel = requestData().run((fail, success) => {
  // response handling code
  // this should not get called if cancel calls before the Task completes
  // and the computation provides a cancellation function like above
});

// oops, didn't need that data after all
cancel();
```

You can also cancel multiple chained Tasks even if one has already completed:

```javascript
const cancel = getUser()
  .map(user => user.name)
  .chain(getFollowers)
  .run(
    fail => {},
    success => {
      // success === [followers] (if all went well)
    }
  });

// If you invoke cancel after the getUser Task has already completed, it will call the cancel function of getFollowers
```

<a name="memoization"></a>
## Memoization
A promise-like feature that allows you to hang on to values already processed within a Task. Computations don't get re-run.

```javascript
var count = 0;
const task = new Task((sendFail, sendSuccess) => {
  const id = setTimeout(() => {
    sendSuccess(++count);
  }, 1000);
  return () => { clearTimeout(id); };
});

const taskOnce = task.memoize();

taskOnce.run(
    fail => {},
    success => {
      // success === 1
      // count === 1
    }
});
taskOnce.run(
    fail => {},
    success => {
      // success === 1
      // count === 1
    }
});
```

<a name="parallel"></a>
## Parallel Tasks
Parallelize multiple Tasks. Returns an array of successes. If one of the Tasks sends a fail then the cancellation functions for all other Tasks (not yet completed) will be called.

```javascript
var count = 0;
function createTask(to) {
  var order = ++count;
  return new Task(sendFail, sendSuccess => {
    var id = setTimeout(() => {
      sendSuccess(order);
    }, to);
    return () => {
      clearTimeout(id);
    };
  });
}

Task.all([
  createTask(100),
  createTask(500),
  createTask(0)
]).run(
  fail => {},
  success => {
    // count === 3
    // success === [3, 1, 2]
  }
});
```

<a name="specifications"></a>
## Specifications compatibility

<a href="https://github.com/fantasyland/fantasy-land">
  <img width="50" height="50" src="https://raw.githubusercontent.com/fantasyland/fantasy-land/master/logo.png" />
</a>
<a href="https://github.com/rpominov/static-land">
  <img width="80" height="50" src="https://raw.githubusercontent.com/rpominov/static-land/master/logo/logo.png" />
</a>

Task is compatible with [Fantasy Land](https://github.com/fantasyland/fantasy-land) and [Static Land](https://github.com/rpominov/static-land) implementing:

- [Semigroup](https://github.com/fantasyland/fantasy-land#semigroup)
- [Monoid](https://github.com/fantasyland/fantasy-land#monoid)
- [Functor](https://github.com/fantasyland/fantasy-land#functor)
- [Bifunctor](https://github.com/fantasyland/fantasy-land#bifunctor)
- [Apply](https://github.com/fantasyland/fantasy-land#apply)
- [Applicative](https://github.com/fantasyland/fantasy-land#applicative)
- [Chain](https://github.com/fantasyland/fantasy-land#chain)
- [Monad](https://github.com/fantasyland/fantasy-land#monad)

<a name="different"></a>
## How is this Task different than Data.Task or Fun-Task
- This Task throw an error if you attempt to call sendFail or sendSuccess if either has already been called.
- This Task offers a memoization method that allow you to treat Tasks more like promises so computations don't get called more than once if multiple parts of your code call `run` on an Task.
- No special or magical error catching involved.

Data.task, fun-task, and this Task are pretty similar and should be fairly interchangeable for the basics.

<a name="credits"></a>
## Credits
A lot of code was inspired and stolen directly from [data.task](https://github.com/folktale/data.task) (Quildreen Motta) and [fun-task](https://github.com/rpominov/fun-task) (Roman Pominov).
