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

## Credits
A lot of code was inspired and stolen directly from [data.task](https://github.com/folktale/data.task) (Quildreen Motta) and [fun-task](https://github.com/rpominov/fun-task) (Roman Pominov).
