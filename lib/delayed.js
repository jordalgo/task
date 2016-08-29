
/**
 * A helper for delaying the execution of a function.
 * Taken from data.task :)
 * @private
 * @summary (Any... -> Any) -> Void
 */
var delayed = typeof setImmediate !== 'undefined'?  setImmediate
            : typeof process !== 'undefined'?       process.nextTick
            : /* otherwise */                       setTimeout

module.exports = delayed;
