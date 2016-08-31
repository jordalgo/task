# Ask

A javascript data type for async requests. Very similar to the [data.task](https://github.com/folktale/data.task) and [fun-task](https://github.com/rpominov/fun-task) with some modifications.

## Example
```javascript
import Ask from 'ask';
const askMe = new Ask((left, right) => {
  const id = setTimeout(() => {
    right(1);
  }, 1000);
  return () => { clearTimeout(id); };
});

const cancel = askMe.run(
  left => {
    // never called;
  },
  right => {
    // right === 1
  }
);
```

## Quick Details
- The functions passed to run are always called async
- You can't complete an Ask more than once e.g. you can't call left and then call right (an error will be thrown).
- Functions passed to Ask can optionally create a cancel (like above) otherwise cancel will be an no-op.
- It's lazy! The function passed on Ask creation is only called when `run` is invoked.
- There is no error catching in an Ask! Errors are not thrown or caught from within an Ask. There are failure values (called lefts) but these are not the same thing as errors -- think of them as 'bad news'.

## Chaining

```javascript
function getUser(id) {
  return new Ask((left, right) => {
    // AJAX request to get a user
    right ({ user });
  });
}

function getFollowers(username) {
  return new Ask((left, right) => {
    // AJAX request using username
    right([followers]);
  });
}

getUser()
.map(user => user.name)
.chain(getFollowers)
.run(
  left => {},
  right => {
    // right === [followers] (if all went well)
  }
});
```

## Memoization

A promise-like feature that allows you to hang on to values already processed within an Ask. Computations don't get re-run.

```javascript
var count = 0;
const askMe = new Ask((left, right) => {
  const id = setTimeout(() => {
    right(++count);
  }, 1000);
  return () => { clearTimeout(id); };
});

const askMeOnce = askMe.memoize();

askMeOnce.run(
    () => {},
    right => {
      // left === null
      // right === 1
      // count === 1
    }
});
askMeOnce.run(
    () => {},
    right => {
      // left === null
      // right === 1
      // count === 1
    }
});
```

## Parallel Asks

Parallelize multiple Asks. Returns an array of rights. If one of the Asks sends a left then the cancelation functions for all other Asks (not yet completed) will be called.

```javascript
var count = 0;
function createAsk(to) {
  var order = ++count;
  return new Ask(left, right => {
    var id = setTimeout(() => {
      right(order);
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
]).run(
  left => {},
  right => {
    // count === 3
    // right === [3, 1, 2]
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

## How are Asks different than Data.Task or Fun-Task
- Asks throw an error if you attempt to call left or right after a left or right has been called.
- Asks offer a memoization method that allow you to treat Asks more like promises so computations dont get called more than once if multiple parts of your code call `run` on an Ask.
- No special or magical error catching involved.

## Credits
A lot of code was inspired and stolen directly from [data.task](https://github.com/folktale/data.task) (Quildreen Motta) and [fun-task](https://github.com/rpominov/fun-task) (Roman Pominov).
