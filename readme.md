# Ask

A javascript data type for async requests. Very similar to the [data.task](https://github.com/folktale/data.task) and [fun-task](https://github.com/rpominov/fun-task) with some modifications.

## Example
```javascript
import Ask from 'ask';
const askMe = new Ask(message => {
  const id = setTimeout(() => {
    message(null, 1);
  }, 1000);
  return () => { clearTimeout(id); };
});

const cancel = askMe.run((left, right) => {
    // left === null
    // right === 1
});
```

## Quick Details
- The function passed to run is always called async
- You can't complete a task more than once e.g. you can't call message with a right/success and later call it with a left/failure; an error will be thrown.
- Functions passed to Ask can optionally create a cancel (like above) otherwise cancel will be an no-op.
- It's lazy! The function passed on Ask creation is only called when `run` is invoked.
- There is no error catching in an Ask! Errors are not thrown or caught from within an Ask. There are failure values (called lefts) but these are not the same thing as errors -- think of them as 'bad news'.
- No rule against passing both a left and right. This allows for fallback values if a left occurs, so you (hopefully) can get a nice error message and a fallback value. However Ask methods like map and apply prioritize the occurance of a left and won't map or apply on a right if a left exists.

## Chaining

```javascript
function getUser(id) {
  return new Ask(message => {
    // AJAX request to get a user
    message(null, { user });
  });
}

function getFollowers(username) {
  return new Ask(message => {
    // AJAX request using username
    message(null, [followers]);
  });
}

getUser()
.map(user => user.name)
.chain(getFollowers)
.run((left, right) => {
  // right === [followers] (if all went well)
});
```

## Memoization

A promise-like feature that allows you to hang on to values already processed within an Ask. Computations don't get re-run.

```javascript
var count = 0;
const askMe = new Ask(message => {
  const id = setTimeout(() => {
    message(null, ++count);
  }, 1000);
  return () => { clearTimeout(id); };
});

const askMeOnce = askMe.memoize();

askMeOnce.run((left, right) => {
    // left === null
    // right === 1
    // count === 1
});
askMeOnce.run((left, right) => {
    // left === null
    // right === 1
    // count === 1
});
```

## Parallel Asks

Parallelize multiple Asks. Returns an array of rights. If one of the Asks sends a left then the cancelation functions for all other Asks (not yet completed) will be called. Bonus! If some Asks **have** completed you get both a left and an array of incomplete rights; this helps with debugging and fallback behavior if you want to proceed even if one of the Asks have failed.

```javascript
var count = 0;
function createAsk(to) {
  var order = ++count;
  return new Ask(message => {
    var id = setTimeout(() => {
      message(null, order);
    }, to);
    return () => {
      clearTimeout(id);
    };
  });
}

Ask.all([
  createAsk(100),
  createAsk(500),
  createAsk(0)
]).run((left, right) => {
  // count === 3
  // right === [3, 2, 1]
});
```

## Credits
A lot of code was inspired and stolen directly from [data.task](https://github.com/folktale/data.task) (Quildreen Motta) and [fun-task](https://github.com/rpominov/fun-task) (Roman Pominov).
