# Ask

A javascript data type for async requests. Very similar to the [data.task](https://github.com/folktale/data.task) and [fun-task](https://github.com/rpominov/fun-task) with some modifications.

Also see [AskOnce](#AskOnce).

## Example
```javascript
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

# AskOnce

Same as an Ask but the computation is only run once and the message values are memoized (similar to a Promise) so if you call run on an Ask more than once it will return the first value async.

## Example
```javascript
var count = 0;
const askMe = new AskOnce(message => {
  // this only gets run once.
  const id = setTimeout(() => {
    message(null, ++count);
  }, 1000);
});

askMe.run((left, right) => {
    // failure === null
    // success === 1
});

askMe.run((left, right) => {
  // left === null,
  // right === 1
});
```
