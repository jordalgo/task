# Task

The `Task[a, b]` structure represents values that depend on time. This
allows one to model time-based effects explicitly, such that one can have
full knowledge of when they're dealing with delayed computations, latency,
or anything that can not be computed immediately.

A common use for this structure is to replace the usual Continuation-Passing
Style form of programming or Promises (if you prefer not to have your error catching
and rejection values handled similarly), in order to be able to compose and sequence
time-dependent effects using the generic and powerful monadic operations.

_Signature_: ((a → b) → c → void) → Task[a, b]

**Parameters**

-   `computation` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `unSafe` **[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** (private)
-   `safe`  

## run

Run the computation originally passed when creating the Task.

**Parameters**

-   `sendFail` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `sendSuccess` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** cancellation

## map

Transforms the success value of the `Task[_, a]` using a regular unary
function.

Exposed as both a static function and a method on the Task prototype.

_Signature_: ((a → b) → Task[_, a]) → Task[_, b]

**Parameters**

-   `mapper` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Task](#task)** 

## bimap

Transforms the fail or success values of the `Task[a, b]` using two regular unary
functions depending on what exists.

Exposed as both a static function and a method on the Task prototype.

_Signature_: ((a → b), (c → d), Task[a, c]) → Task[b, d]

**Parameters**

-   `mapValueFail` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `mapValueSuccess` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Task](#task)** 

## chain

Transforms the success value of the `Task[a, b]` using a function to a
monad.

Exposed as both a static function and a method on the Task prototype.

_Signature_: ((b → Task[c, d]) → @Task[a, b]) → Task[c, d]

**Parameters**

-   `taskMaker` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Task](#task)** 

## bichain

Passes both the fail and success values of the `Task[a, b]`
to a function that returns an `Task[d, e]`.

Exposed as both a static function and a method on the Task prototype.

_Signature_: (a → Task[d, e]) → (b → Task[d, e]) → Task[d, e]

**Parameters**

-   `taskMakerOnFail` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `taskMakerOnSuccess` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Task](#task)** 

## ap

Applys the success value of the `Task[_, (b → c)]` to the success
value of the `Task[d, b]`. Fails with the first failure
and throws the second away if it occurs.

Exposed as both a static function and a method on the Task prototype.

_Signature_: (Task[d, b] → Task[_, (b → c)]) → Task[_, c]

**Parameters**

-   `taskValue` **[Task](#task)** 

Returns **[Task](#task)** 

## concat

Take the earlier of the two Tasks

Exposed as both a static function and a method on the Task prototype.

_Signature_: (Task[a, b] → Task[a → b)]) → Task[a, b]

**Parameters**

-   `taskA` **[Task](#task)** 

Returns **[Task](#task)** 

## cache

Caches the fail and success values from an Task[a, b].
Run can be called multiple times on the produced Task
and the computation is not re-run.

Exposed as both a static function and a method on the Task prototype.

_Signature_: Task[a, b] → Task[a, b]

Returns **[Task](#task)** 

## of

Constructs a new `Task[_, b]` containing the single success value `b`.

`b` can be any value, including `null`, `undefined`, or another
`Task[a, b]` structure.

Exposed as both a static function and a method on the Task prototype.

_Signature_: b → Task[_, b]

**Parameters**

-   `success` **Any** 

Returns **[Task](#task)** 

## fail

Constructs a new `Task[a, _]` containing the single fail value `a`.

`a` can be any value, including `null`, `undefined`, or another
`Task[a, b]` structure.

Exposed as both a static function and a method on the Task prototype.

_Signature_: a → Task[a, _]

**Parameters**

-   `fail` **Any** 

Returns **[Task](#task)** 

## empty

Returns an Task that will never resolve

Exposed as both a static function and a method on the Task prototype.

_Signature_: Void → Task[_, _]

Returns **[Task](#task)** 

## fork

Alias for `run`.

## callback

Callback style run which passes fail and success
as the first and second arguments.
Use of this function is not advised as fail values are allowed to be null
though you probably shouldn't be indicating a fail with null :)

_Signature_: (a, b) → (\_ → void)

**Parameters**

-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** cancel

## orElse

Creates a task that sends a success if it receives a fail
and passes on the value if it receives a success.

_Signature_: a → Task[_, a]

**Parameters**

-   `else` **Any** 
-   `elseValue`  

Returns **[Task](#task)** 

# TaskMaker

Exported Factory function for Tasks.
Also includes many utility methods.

**Parameters**

-   `computation` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Task](#task)** 

## after

Creates a Task that sends a success after x milliseconds

**Parameters**

-   `ms` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `success` **Any** 

Returns **[Task](#task)** 

## all

Creates a single Task out of many that doesnt complete
until each resolve with all successs or a single fail occurs.
Will pass the incomplete array of successs if some have occured before a fail.

_Signature_: \[Task[a, b]] → Task\[a, [b]]

**Parameters**

-   `taskArray` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)** 

Returns **[Task](#task)** 
