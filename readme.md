# Task

A javascript data type for async requests. Very similar to the [data.task](https://github.com/folktale/data.task) and [fun-task](https://github.com/rpominov/fun-task) with some modifications. Published as jordalgo-task

## Installing
```
npm install jordalgo-task
```

## Example
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

## Quick Details
- The functions passed to run are always called async
- You can't complete a Task more than once e.g. you can't call sendFail and then call sendSuccess (an error will be thrown).
- Functions passed to Task can optionally create a cancel (like above) otherwise cancel will be an no-op.
- It's lazy! The function passed on Task creation is only called when `run` is invoked.
- There is no error catching in this Task implementation. Errors are not thrown or caught from within a Task. There are failure values but these are not the same thing as errors -- think of them as "bad news".

## Chaining

```javascript
function getUser(id) {
  return new Task((sendFail, sendSuccess) => {
    // AJAX request to get a user with id
    sendSuccess({ user });
  });
}

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

## Parallel Tasks

Parallelize multiple Tasks. Returns an array of successs. If one of the Tasks sends a fail then the cancelation functions for all other Tasks (not yet completed) will be called.

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

## How is this Task different than Data.Task or Fun-Task
- This Task throw an error if you attempt to call sendFail or sendSuccess if either has already been called.
- This Task offers a memoization method that allow you to treat Tasks more like promises so computations don't get called more than once if multiple parts of your code call `run` on an Task.
- No special or magical error catching involved.

## Credits
A lot of code was inspired and stolen directly from [data.task](https://github.com/folktale/data.task) (Quildreen Motta) and [fun-task](https://github.com/rpominov/fun-task) (Roman Pominov).
