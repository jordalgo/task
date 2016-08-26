# Ask

A javascript data type for async requests. Very similar to the [data.task](https://github.com/folktale/data.task) and [fun-task](https://github.com/rpominov/fun-task) with some additional features.

## Example
```
const askMe = new Ask(message => {
  const id = setTimeout(() => {
    message(null, 1);
  }, 1000);
  return () => { clearTimeout(id); };
});

const cancel = askMe.run((bad, good) => {
    // bad === null
    // good === 1
});
```

## Quick Details
- The function passed to run is always called async
- `run` can be called multiple times but after the first time it will return the value from the first computation (async)
- You can't complete a task more than once e.g. you can't call message with a success and later call it with an error; an error will be thrown.
- Functions passed to Ask can optionally create a cancel (like above) otherwise cancel will be an no-op.
- The function passed on Ask creation is only called when `run` is invoked.
- There is no error catching in an Ask! Errors are expected failures and are not thrown or caught from within an Ask.
