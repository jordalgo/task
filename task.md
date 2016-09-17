# Task

The `Task[a, b]` structure represents values that depend on time. This
allows one to model time-based effects explicitly, such that one can have
full knowledge of when they're dealing with delayed computations, latency,
or anything that can not be computed immediately.

A common use for this structure is to replace the usual Continuation-Passing
Style form of programming or Promises (if you prefer not to have your error catching
and rejection values handled similarly), in order to be able to compose and sequence
time-dependent effects using the generic and powerful monadic operations.

_Signature_: ((a → b) → c) → Task[a, b]

**Parameters**

-   `computation` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

## map

Transforms the success value of the `Task[l, a]` using a regular unary
function.

_Signature_: ((a → b) → Task[l, a]) → Task[l, b]

**Parameters**

-   `fn` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `task` **[Task](#task)** 

Returns **[Task](#task)** 

## bimap

Transforms the fail or success values of the `Task[a, b]` using two regular unary
functions depending on what exists.

_Signature_: ((a → b), (c → d), Task[a, c]) → Task[b, d]

**Parameters**

-   `fnFail` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `fnSuccess` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `task` **[Task](#task)** 

Returns **[Task](#task)** 

## chain

Transforms the success value of the `Task[a, b]` using a function to a
monad.

_Signature_: ((b → Task[c, d]) → @Task[a, b]) → Task[a, d]

**Parameters**

-   `fn` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `task` **[Task](#task)** 

Returns **[Task](#task)** 

## bichain

Passes both the fail and success values of the `Task[a, b]`
to a function that returns an `Task[c, d]`.

_Signature_: ((a → c) → (b → d) → Task[a, b]) → Task[c, d]

**Parameters**

-   `fnFail` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `fnSuccess` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `task` **[Task](#task)** 

Returns **[Task](#task)** 

## ap

Applys the success value of the `Task[a, (b → c)]` to the success
value of the `Task[d, b]`

_Signature_: (Task[d, b] → Task[a, (b → c)]) → Task[a, c]

**Parameters**

-   `taskP` **[Task](#task)** 
-   `taskZ` **[Task](#task)** 

Returns **[Task](#task)** 

## concat

Take the earlier of the two Tasks

_Signature_: (Task[a, b] → Task[a → b)]) → Task[a, b]

**Parameters**

-   `taskA` **[Task](#task)** 
-   `taskB` **[Task](#task)** 

Returns **[Task](#task)** 

## cache

Caches the fail and success values from an Task[a, b].
Run can be called multiple times on the produced Task
and the computation is not re-run.

_Signature_: Task[a, b] → Ask[a, b]

**Parameters**

-   `task` **[Task](#task)** 

Returns **[Task](#task)** 

## of

Constructs a new `Task[a, b]` containing the single value `b`.

`b` can be any value, including `null`, `undefined`, or another
`Task[a, b]` structure.

_Signature_: b → Task[_, b]

**Parameters**

-   `success` **Any** 

Returns **[Task](#task)** 

## fail

Constructs a new `Task[a, b]` containing the single value `a`.

`a` can be any value, including `null`, `undefined`, or another
`Task[a, b]` structure.

_Signature_: a → Task[a, _]

**Parameters**

-   `f` **Any** 

Returns **[Task](#task)** 

## empty

Returns an Task that will never resolve

_Signature_: Void → Task[_, _]

Returns **[Task](#task)** 

## create

Factory function for creating a new `Task[a, b]`

_Signature_: ((a → b) → c) → Task[a, b]

**Parameters**

-   `computation` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Task](#task)** 

## all

Creates a single Task out of many that doesnt complete
until each resolve with all successs or a single fail occurs.
Will pass the incomplete array of successs if some have occured before a fail.

_Signature_: \[Task[a, b]] → Task\[a, [b]]

**Parameters**

-   `taskArray` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)** 

Returns **[Task](#task)** 
