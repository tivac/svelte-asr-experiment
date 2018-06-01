(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
(function () {
	'use strict';

	var combineArrays = function(obj) {
		var keys = Object.keys(obj);

		keys.forEach(function(key) {
			if (!Array.isArray(obj[key])) {
				throw new Error(key + ' is not an array')
			}
		});

		var maxIndex = keys.reduce(function(maxSoFar, key) {
			var len = obj[key].length;
			return maxSoFar > len ? maxSoFar : len
		}, 0);

		var output = [];

		function getObject(index) {
			var o = {};
			keys.forEach(function(key) {
				o[key] = obj[key][index];
			});
			return o
		}

		for (var i = 0; i < maxIndex; ++i) {
			output.push(getObject(i));
		}

		return output
	};

	var isarray = Array.isArray || function (arr) {
	  return Object.prototype.toString.call(arr) == '[object Array]';
	};

	/**
	 * Expose `pathToRegexp`.
	 */
	var pathToRegexpWithReversibleKeys = pathToRegexp;

	/**
	 * The main path matching regexp utility.
	 *
	 * @type {RegExp}
	 */
	var PATH_REGEXP = new RegExp([
	  // Match escaped characters that would otherwise appear in future matches.
	  // This allows the user to escape special characters that won't transform.
	  '(\\\\.)',
	  // Match Express-style parameters and un-named parameters with a prefix
	  // and optional suffixes. Matches appear as:
	  //
	  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
	  // "/route(\\d+)" => [undefined, undefined, undefined, "\d+", undefined]
	  '([\\/.])?(?:\\:(\\w+)(?:\\(((?:\\\\.|[^)])*)\\))?|\\(((?:\\\\.|[^)])*)\\))([+*?])?',
	  // Match regexp special characters that are always escaped.
	  '([.+*?=^!:${}()[\\]|\\/])'
	].join('|'), 'g');

	/**
	 * Escape the capturing group by escaping special characters and meaning.
	 *
	 * @param  {String} group
	 * @return {String}
	 */
	function escapeGroup (group) {
	  return group.replace(/([=!:$\/()])/g, '\\$1');
	}

	/**
	 * Attach the keys as a property of the regexp.
	 *
	 * @param  {RegExp} re
	 * @param  {Array}  keys
	 * @return {RegExp}
	 */
	function attachKeys (re, keys, allTokens) {
	  re.keys = keys;
	  re.allTokens = allTokens;
	  return re;
	}

	/**
	 * Get the flags for a regexp from the options.
	 *
	 * @param  {Object} options
	 * @return {String}
	 */
	function flags (options) {
	  return options.sensitive ? '' : 'i';
	}

	/**
	 * Pull out keys from a regexp.
	 *
	 * @param  {RegExp} path
	 * @param  {Array}  keys
	 * @return {RegExp}
	 */
	function regexpToRegexp (path, keys, allTokens) {
	  // Use a negative lookahead to match only capturing groups.
	  var groups = path.source.match(/\((?!\?)/g);

	  if (groups) {
	    for (var i = 0; i < groups.length; i++) {
	      keys.push({
	        name:      i,
	        delimiter: null,
	        optional:  false,
	        repeat:    false
	      });
	    }
	  }

	  return attachKeys(path, keys, allTokens);
	}

	/**
	 * Transform an array into a regexp.
	 *
	 * @param  {Array}  path
	 * @param  {Array}  keys
	 * @param  {Object} options
	 * @return {RegExp}
	 */
	function arrayToRegexp (path, keys, options, allTokens) {
	  var parts = [];

	  for (var i = 0; i < path.length; i++) {
	    parts.push(pathToRegexp(path[i], keys, options, allTokens).source);
	  }

	  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));
	  return attachKeys(regexp, keys, allTokens);
	}

	/**
	 * Replace the specific tags with regexp strings.
	 *
	 * @param  {String} path
	 * @param  {Array}  keys
	 * @return {String}
	 */
	function replacePath (path, keys, allTokens) {
	  var index = 0;
	  var lastEndIndex = 0;

	  function addLastToken(lastToken) {
	    if (lastEndIndex === 0 && lastToken[0] !== '/') {
	      lastToken = '/' + lastToken;
	    }
	    allTokens.push({
	      string: lastToken
	    });
	  }


	  function replace (match, escaped, prefix, key, capture, group, suffix, escape, offset) {
	    if (escaped) {
	      return escaped;
	    }

	    if (escape) {
	      return '\\' + escape;
	    }

	    var repeat   = suffix === '+' || suffix === '*';
	    var optional = suffix === '?' || suffix === '*';

	    if (offset > lastEndIndex) {
	      addLastToken(path.substring(lastEndIndex, offset));
	    }

	    lastEndIndex = offset + match.length;

	    var newKey = {
	      name:      key || index++,
	      delimiter: prefix || '/',
	      optional:  optional,
	      repeat:    repeat
	    };

	    keys.push(newKey);
	    allTokens.push(newKey);

	    prefix = prefix ? ('\\' + prefix) : '';
	    capture = escapeGroup(capture || group || '[^' + (prefix || '\\/') + ']+?');

	    if (repeat) {
	      capture = capture + '(?:' + prefix + capture + ')*';
	    }

	    if (optional) {
	      return '(?:' + prefix + '(' + capture + '))?';
	    }

	    // Basic parameter support.
	    return prefix + '(' + capture + ')';
	  }

	  var newPath = path.replace(PATH_REGEXP, replace);

	  if (lastEndIndex < path.length) {
	    addLastToken(path.substring(lastEndIndex));
	  }

	  return newPath;
	}

	/**
	 * Normalize the given path string, returning a regular expression.
	 *
	 * An empty array can be passed in for the keys, which will hold the
	 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
	 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
	 *
	 * @param  {(String|RegExp|Array)} path
	 * @param  {Array}                 [keys]
	 * @param  {Object}                [options]
	 * @return {RegExp}
	 */
	function pathToRegexp (path, keys, options, allTokens) {
	  keys = keys || [];
	  allTokens = allTokens || [];

	  if (!isarray(keys)) {
	    options = keys;
	    keys = [];
	  } else if (!options) {
	    options = {};
	  }

	  if (path instanceof RegExp) {
	    return regexpToRegexp(path, keys, options, allTokens);
	  }

	  if (isarray(path)) {
	    return arrayToRegexp(path, keys, options, allTokens);
	  }

	  var strict = options.strict;
	  var end = options.end !== false;
	  var route = replacePath(path, keys, allTokens);
	  var endsWithSlash = path.charAt(path.length - 1) === '/';

	  // In non-strict mode we allow a slash at the end of match. If the path to
	  // match already ends with a slash, we remove it for consistency. The slash
	  // is valid at the end of a path match, not in the middle. This is important
	  // in non-ending mode, where "/test/" shouldn't match "/test//route".
	  if (!strict) {
	    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?';
	  }

	  if (end) {
	    route += '$';
	  } else {
	    // In non-ending mode, we need the capturing groups to match as much as
	    // possible by using a positive lookahead to the end or next path segment.
	    route += strict && endsWithSlash ? '' : '(?=\\/|$)';
	  }

	  return attachKeys(new RegExp('^' + route, flags(options)), keys, allTokens);
	}

	var thenDenodeify = function denodeify(fn) {
		return function() {
			var self = this;
			var args = Array.prototype.slice.call(arguments);
			return new Promise(function(resolve, reject) {
				args.push(function(err, res) {
					if (err) {
						reject(err);
					} else {
						resolve(res);
					}
				});

				var res = fn.apply(self, args);

				var isPromise = res
					&& (typeof res === 'object' || typeof res === 'function')
					&& typeof res.then === 'function';

				if (isPromise) {
					resolve(res);
				}
			})
		}
	};

	var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var eventemitter3 = createCommonjsModule(function (module) {

	var has = Object.prototype.hasOwnProperty
	  , prefix = '~';

	/**
	 * Constructor to create a storage for our `EE` objects.
	 * An `Events` instance is a plain object whose properties are event names.
	 *
	 * @constructor
	 * @api private
	 */
	function Events() {}

	//
	// We try to not inherit from `Object.prototype`. In some engines creating an
	// instance in this way is faster than calling `Object.create(null)` directly.
	// If `Object.create(null)` is not supported we prefix the event names with a
	// character to make sure that the built-in object properties are not
	// overridden or used as an attack vector.
	//
	if (Object.create) {
	  Events.prototype = Object.create(null);

	  //
	  // This hack is needed because the `__proto__` property is still inherited in
	  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
	  //
	  if (!new Events().__proto__) prefix = false;
	}

	/**
	 * Representation of a single event listener.
	 *
	 * @param {Function} fn The listener function.
	 * @param {Mixed} context The context to invoke the listener with.
	 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
	 * @constructor
	 * @api private
	 */
	function EE(fn, context, once) {
	  this.fn = fn;
	  this.context = context;
	  this.once = once || false;
	}

	/**
	 * Minimal `EventEmitter` interface that is molded against the Node.js
	 * `EventEmitter` interface.
	 *
	 * @constructor
	 * @api public
	 */
	function EventEmitter() {
	  this._events = new Events();
	  this._eventsCount = 0;
	}

	/**
	 * Return an array listing the events for which the emitter has registered
	 * listeners.
	 *
	 * @returns {Array}
	 * @api public
	 */
	EventEmitter.prototype.eventNames = function eventNames() {
	  var names = []
	    , events
	    , name;

	  if (this._eventsCount === 0) return names;

	  for (name in (events = this._events)) {
	    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
	  }

	  if (Object.getOwnPropertySymbols) {
	    return names.concat(Object.getOwnPropertySymbols(events));
	  }

	  return names;
	};

	/**
	 * Return the listeners registered for a given event.
	 *
	 * @param {String|Symbol} event The event name.
	 * @param {Boolean} exists Only check if there are listeners.
	 * @returns {Array|Boolean}
	 * @api public
	 */
	EventEmitter.prototype.listeners = function listeners(event, exists) {
	  var evt = prefix ? prefix + event : event
	    , available = this._events[evt];

	  if (exists) return !!available;
	  if (!available) return [];
	  if (available.fn) return [available.fn];

	  for (var i = 0, l = available.length, ee = new Array(l); i < l; i++) {
	    ee[i] = available[i].fn;
	  }

	  return ee;
	};

	/**
	 * Calls each of the listeners registered for a given event.
	 *
	 * @param {String|Symbol} event The event name.
	 * @returns {Boolean} `true` if the event had listeners, else `false`.
	 * @api public
	 */
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return false;

	  var listeners = this._events[evt]
	    , len = arguments.length
	    , args
	    , i;

	  if (listeners.fn) {
	    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

	    switch (len) {
	      case 1: return listeners.fn.call(listeners.context), true;
	      case 2: return listeners.fn.call(listeners.context, a1), true;
	      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
	      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
	      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
	      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
	    }

	    for (i = 1, args = new Array(len -1); i < len; i++) {
	      args[i - 1] = arguments[i];
	    }

	    listeners.fn.apply(listeners.context, args);
	  } else {
	    var length = listeners.length
	      , j;

	    for (i = 0; i < length; i++) {
	      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

	      switch (len) {
	        case 1: listeners[i].fn.call(listeners[i].context); break;
	        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
	        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
	        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
	        default:
	          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
	            args[j - 1] = arguments[j];
	          }

	          listeners[i].fn.apply(listeners[i].context, args);
	      }
	    }
	  }

	  return true;
	};

	/**
	 * Add a listener for a given event.
	 *
	 * @param {String|Symbol} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {Mixed} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @api public
	 */
	EventEmitter.prototype.on = function on(event, fn, context) {
	  var listener = new EE(fn, context || this)
	    , evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) this._events[evt] = listener, this._eventsCount++;
	  else if (!this._events[evt].fn) this._events[evt].push(listener);
	  else this._events[evt] = [this._events[evt], listener];

	  return this;
	};

	/**
	 * Add a one-time listener for a given event.
	 *
	 * @param {String|Symbol} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {Mixed} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @api public
	 */
	EventEmitter.prototype.once = function once(event, fn, context) {
	  var listener = new EE(fn, context || this, true)
	    , evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) this._events[evt] = listener, this._eventsCount++;
	  else if (!this._events[evt].fn) this._events[evt].push(listener);
	  else this._events[evt] = [this._events[evt], listener];

	  return this;
	};

	/**
	 * Remove the listeners of a given event.
	 *
	 * @param {String|Symbol} event The event name.
	 * @param {Function} fn Only remove the listeners that match this function.
	 * @param {Mixed} context Only remove the listeners that have this context.
	 * @param {Boolean} once Only remove one-time listeners.
	 * @returns {EventEmitter} `this`.
	 * @api public
	 */
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return this;
	  if (!fn) {
	    if (--this._eventsCount === 0) this._events = new Events();
	    else delete this._events[evt];
	    return this;
	  }

	  var listeners = this._events[evt];

	  if (listeners.fn) {
	    if (
	         listeners.fn === fn
	      && (!once || listeners.once)
	      && (!context || listeners.context === context)
	    ) {
	      if (--this._eventsCount === 0) this._events = new Events();
	      else delete this._events[evt];
	    }
	  } else {
	    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
	      if (
	           listeners[i].fn !== fn
	        || (once && !listeners[i].once)
	        || (context && listeners[i].context !== context)
	      ) {
	        events.push(listeners[i]);
	      }
	    }

	    //
	    // Reset the array, or remove it completely if we have no more listeners.
	    //
	    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
	    else if (--this._eventsCount === 0) this._events = new Events();
	    else delete this._events[evt];
	  }

	  return this;
	};

	/**
	 * Remove all listeners, or those of the specified event.
	 *
	 * @param {String|Symbol} [event] The event name.
	 * @returns {EventEmitter} `this`.
	 * @api public
	 */
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
	  var evt;

	  if (event) {
	    evt = prefix ? prefix + event : event;
	    if (this._events[evt]) {
	      if (--this._eventsCount === 0) this._events = new Events();
	      else delete this._events[evt];
	    }
	  } else {
	    this._events = new Events();
	    this._eventsCount = 0;
	  }

	  return this;
	};

	//
	// Alias methods names because people roll like that.
	//
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;

	//
	// This function doesn't apply anymore.
	//
	EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
	  return this;
	};

	//
	// Expose the prefix.
	//
	EventEmitter.prefixed = prefix;

	//
	// Allow `EventEmitter` to be imported as module namespace.
	//
	EventEmitter.EventEmitter = EventEmitter;

	//
	// Expose the module.
	//
	{
	  module.exports = EventEmitter;
	}
	});

	var strictUriEncode = function (str) {
		return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
			return '%' + c.charCodeAt(0).toString(16).toUpperCase();
		});
	};

	/*
	object-assign
	(c) Sindre Sorhus
	@license MIT
	*/
	/* eslint-disable no-unused-vars */
	var getOwnPropertySymbols = Object.getOwnPropertySymbols;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	var propIsEnumerable = Object.prototype.propertyIsEnumerable;

	function toObject(val) {
		if (val === null || val === undefined) {
			throw new TypeError('Object.assign cannot be called with null or undefined');
		}

		return Object(val);
	}

	function shouldUseNative() {
		try {
			if (!Object.assign) {
				return false;
			}

			// Detect buggy property enumeration order in older V8 versions.

			// https://bugs.chromium.org/p/v8/issues/detail?id=4118
			var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
			test1[5] = 'de';
			if (Object.getOwnPropertyNames(test1)[0] === '5') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test2 = {};
			for (var i = 0; i < 10; i++) {
				test2['_' + String.fromCharCode(i)] = i;
			}
			var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
				return test2[n];
			});
			if (order2.join('') !== '0123456789') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test3 = {};
			'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
				test3[letter] = letter;
			});
			if (Object.keys(Object.assign({}, test3)).join('') !==
					'abcdefghijklmnopqrst') {
				return false;
			}

			return true;
		} catch (err) {
			// We don't expect any of the above to throw, but better to be safe.
			return false;
		}
	}

	var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
		var from;
		var to = toObject(target);
		var symbols;

		for (var s = 1; s < arguments.length; s++) {
			from = Object(arguments[s]);

			for (var key in from) {
				if (hasOwnProperty.call(from, key)) {
					to[key] = from[key];
				}
			}

			if (getOwnPropertySymbols) {
				symbols = getOwnPropertySymbols(from);
				for (var i = 0; i < symbols.length; i++) {
					if (propIsEnumerable.call(from, symbols[i])) {
						to[symbols[i]] = from[symbols[i]];
					}
				}
			}
		}

		return to;
	};

	function encoderForArrayFormat(opts) {
		switch (opts.arrayFormat) {
			case 'index':
				return function (key, value, index) {
					return value === null ? [
						encode(key, opts),
						'[',
						index,
						']'
					].join('') : [
						encode(key, opts),
						'[',
						encode(index, opts),
						']=',
						encode(value, opts)
					].join('');
				};

			case 'bracket':
				return function (key, value) {
					return value === null ? encode(key, opts) : [
						encode(key, opts),
						'[]=',
						encode(value, opts)
					].join('');
				};

			default:
				return function (key, value) {
					return value === null ? encode(key, opts) : [
						encode(key, opts),
						'=',
						encode(value, opts)
					].join('');
				};
		}
	}

	function parserForArrayFormat(opts) {
		var result;

		switch (opts.arrayFormat) {
			case 'index':
				return function (key, value, accumulator) {
					result = /\[(\d*)\]$/.exec(key);

					key = key.replace(/\[\d*\]$/, '');

					if (!result) {
						accumulator[key] = value;
						return;
					}

					if (accumulator[key] === undefined) {
						accumulator[key] = {};
					}

					accumulator[key][result[1]] = value;
				};

			case 'bracket':
				return function (key, value, accumulator) {
					result = /(\[\])$/.exec(key);
					key = key.replace(/\[\]$/, '');

					if (!result) {
						accumulator[key] = value;
						return;
					} else if (accumulator[key] === undefined) {
						accumulator[key] = [value];
						return;
					}

					accumulator[key] = [].concat(accumulator[key], value);
				};

			default:
				return function (key, value, accumulator) {
					if (accumulator[key] === undefined) {
						accumulator[key] = value;
						return;
					}

					accumulator[key] = [].concat(accumulator[key], value);
				};
		}
	}

	function encode(value, opts) {
		if (opts.encode) {
			return opts.strict ? strictUriEncode(value) : encodeURIComponent(value);
		}

		return value;
	}

	function keysSorter(input) {
		if (Array.isArray(input)) {
			return input.sort();
		} else if (typeof input === 'object') {
			return keysSorter(Object.keys(input)).sort(function (a, b) {
				return Number(a) - Number(b);
			}).map(function (key) {
				return input[key];
			});
		}

		return input;
	}

	var extract = function (str) {
		return str.split('?')[1] || '';
	};

	var parse = function (str, opts) {
		opts = objectAssign({arrayFormat: 'none'}, opts);

		var formatter = parserForArrayFormat(opts);

		// Create an object with no prototype
		// https://github.com/sindresorhus/query-string/issues/47
		var ret = Object.create(null);

		if (typeof str !== 'string') {
			return ret;
		}

		str = str.trim().replace(/^(\?|#|&)/, '');

		if (!str) {
			return ret;
		}

		str.split('&').forEach(function (param) {
			var parts = param.replace(/\+/g, ' ').split('=');
			// Firefox (pre 40) decodes `%3D` to `=`
			// https://github.com/sindresorhus/query-string/pull/37
			var key = parts.shift();
			var val = parts.length > 0 ? parts.join('=') : undefined;

			// missing `=` should be `null`:
			// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
			val = val === undefined ? null : decodeURIComponent(val);

			formatter(decodeURIComponent(key), val, ret);
		});

		return Object.keys(ret).sort().reduce(function (result, key) {
			var val = ret[key];
			if (Boolean(val) && typeof val === 'object' && !Array.isArray(val)) {
				// Sort object keys, not values
				result[key] = keysSorter(val);
			} else {
				result[key] = val;
			}

			return result;
		}, Object.create(null));
	};

	var stringify = function (obj, opts) {
		var defaults = {
			encode: true,
			strict: true,
			arrayFormat: 'none'
		};

		opts = objectAssign(defaults, opts);

		var formatter = encoderForArrayFormat(opts);

		return obj ? Object.keys(obj).sort().map(function (key) {
			var val = obj[key];

			if (val === undefined) {
				return '';
			}

			if (val === null) {
				return encode(key, opts);
			}

			if (Array.isArray(val)) {
				var result = [];

				val.slice().forEach(function (val2) {
					if (val2 === undefined) {
						return;
					}

					result.push(formatter(key, val2, result.length));
				});

				return result.join('&');
			}

			return encode(key, opts) + '=' + encode(val, opts);
		}).filter(function (x) {
			return x.length > 0;
		}).join('&') : '';
	};

	var queryString = {
		extract: extract,
		parse: parse,
		stringify: stringify
	};

	var immutable = extend;

	var hasOwnProperty$1 = Object.prototype.hasOwnProperty;

	function extend() {
	    var target = {};

	    for (var i = 0; i < arguments.length; i++) {
	        var source = arguments[i];

	        for (var key in source) {
	            if (hasOwnProperty$1.call(source, key)) {
	                target[key] = source[key];
	            }
	        }
	    }

	    return target
	}

	var hashLocation = function HashLocation(window) {
		var emitter = new eventemitter3();
		var last = '';
		var needToDecode = getNeedToDecode();

		window.addEventListener('hashchange', function() {
			if (last !== emitter.get()) {
				last = emitter.get();
				emitter.emit('hashchange');
			}

		});

		function ifRouteIsDifferent(actualNavigateFunction) {
			return function navigate(newPath) {
				if (newPath !== last) {
					actualNavigateFunction(window, newPath);
				}
			}
		}

		emitter.go = ifRouteIsDifferent(go);
		emitter.replace = ifRouteIsDifferent(replace);
		emitter.get = get.bind(null, window, needToDecode);

		return emitter
	};

	function replace(window, newPath) {
		window.location.replace(everythingBeforeTheSlash(window.location.href) + '#' + newPath);
	}

	function everythingBeforeTheSlash(url) {
		var hashIndex = url.indexOf('#');
		return hashIndex === -1 ? url : url.substring(0, hashIndex)
	}

	function go(window, newPath) {
		window.location.hash = newPath;
	}

	function get(window, needToDecode) {
		var hash = removeHashFromPath(window.location.hash);
		return needToDecode ? decodeURI(hash) : hash
	}

	function removeHashFromPath(path) {
		return (path && path[0] === '#') ? path.substr(1) : path
	}

	function getNeedToDecode() {
		var a = document.createElement('a');
		a.href = '#x x';
		return !/x x/.test(a.hash)
	}

	var hashBrownRouter = function Router(opts, hashLocation$$1) {
		var emitter = new eventemitter3();
		if (isHashLocation(opts)) {
			hashLocation$$1 = opts;
			opts = null;
		}

		opts = opts || {};

		if (!hashLocation$$1) {
			hashLocation$$1 = hashLocation(window);
		}

		function onNotFound(path, queryStringParameters) {
			emitter.emit('not found', path, queryStringParameters);
		}

		var routes = [];

		var onHashChange = evaluateCurrentPath.bind(null, routes, hashLocation$$1, !!opts.reverse, onNotFound);

		hashLocation$$1.on('hashchange', onHashChange);

		function stop() {
			hashLocation$$1.removeListener('hashchange', onHashChange);
		}

		emitter.add = add.bind(null, routes);
		emitter.stop = stop;
		emitter.evaluateCurrent = evaluateCurrentPathOrGoToDefault.bind(null, routes, hashLocation$$1, !!opts.reverse, onNotFound);
		emitter.replace = hashLocation$$1.replace;
		emitter.go = hashLocation$$1.go;
		emitter.location = hashLocation$$1;

		return emitter
	};

	function evaluateCurrentPath(routes, hashLocation$$1, reverse, onNotFound) {
		evaluatePath(routes, stripHashFragment(hashLocation$$1.get()), reverse, onNotFound);
	}

	function getPathParts(path) {
		var chunks = path.split('?');
		return {
			path: chunks.shift(),
			queryString: queryString.parse(chunks.join('')),
		}
	}

	function evaluatePath(routes, path, reverse, onNotFound) {
		var pathParts = getPathParts(path);
		path = pathParts.path;
		var queryStringParameters = pathParts.queryString;

		var matchingRoute = find((reverse ? reverseArray(routes) : routes), path);

		if (matchingRoute) {
			var regexResult = matchingRoute.exec(path);
			var routeParameters = makeParametersObjectFromRegexResult(matchingRoute.keys, regexResult);
			var params = immutable(queryStringParameters, routeParameters);
			matchingRoute.fn(params);
		} else {
			onNotFound(path, queryStringParameters);
		}
	}

	function reverseArray(ary) {
		return ary.slice().reverse()
	}

	function makeParametersObjectFromRegexResult(keys, regexResult) {
		return keys.reduce(function(memo, urlKey, index) {
			memo[urlKey.name] = regexResult[index + 1];
			return memo
		}, {})
	}

	function add(routes, routeString, routeFunction) {
		if (typeof routeFunction !== 'function') {
			throw new Error('The router add function must be passed a callback function')
		}
		var newRoute = pathToRegexpWithReversibleKeys(routeString);
		newRoute.fn = routeFunction;
		routes.push(newRoute);
	}

	function evaluateCurrentPathOrGoToDefault(routes, hashLocation$$1, reverse, onNotFound, defaultPath) {
		var currentLocation = stripHashFragment(hashLocation$$1.get());
		var canUseCurrentLocation = currentLocation && (currentLocation !== '/' || defaultPath === '/');

		if (canUseCurrentLocation) {
			var routesCopy = routes.slice();
			evaluateCurrentPath(routesCopy, hashLocation$$1, reverse, onNotFound);
		} else {
			hashLocation$$1.go(defaultPath);
		}
	}

	var urlWithoutHashFragmentRegex = /^([^#]*)(:?#.*)?$/;
	function stripHashFragment(url) {
		var match = url.match(urlWithoutHashFragmentRegex);
		return match ? match[1] : ''
	}

	function isHashLocation(hashLocation$$1) {
		return hashLocation$$1 && hashLocation$$1.go && hashLocation$$1.replace && hashLocation$$1.on
	}

	function find(aryOfRegexes, str) {
		for (var i = 0; i < aryOfRegexes.length; ++i) {
			if (str.match(aryOfRegexes[i])) {
				return aryOfRegexes[i]
			}
		}
	}

	// This file to be replaced with an official implementation maintained by
	// the page.js crew if and when that becomes an option



	var pathParser = function(pathString) {
		var parseResults = pathToRegexpWithReversibleKeys(pathString);

		// The only reason I'm returning a new object instead of the results of the pathToRegexp
		// function is so that if the official implementation ends up returning an
		// allTokens-style array via some other mechanism, I may be able to change this file
		// without having to change the rest of the module in index.js
		return {
			regex: parseResults,
			allTokens: parseResults.allTokens
		}
	};

	var stringifyQuerystring = queryString.stringify;

	var pagePathBuilder = function(pathStr, parameters) {
		var parsed = typeof pathStr === 'string' ? pathParser(pathStr) : pathStr;
		var allTokens = parsed.allTokens;
		var regex = parsed.regex;

		if (parameters) {
			var path = allTokens.map(function(bit) {
				if (bit.string) {
					return bit.string
				}

				var defined = typeof parameters[bit.name] !== 'undefined';
				if (!bit.optional && !defined) {
					throw new Error('Must supply argument ' + bit.name + ' for path ' + pathStr)
				}

				return defined ? (bit.delimiter + encodeURIComponent(parameters[bit.name])) : ''
			}).join('');

			if (!regex.test(path)) {
				throw new Error('Provided arguments do not match the original arguments')
			}

			return buildPathWithQuerystring(path, parameters, allTokens)
		} else {
			return parsed
		}
	};

	function buildPathWithQuerystring(path, parameters, tokenArray) {
		var parametersInQuerystring = getParametersWithoutMatchingToken(parameters, tokenArray);

		if (Object.keys(parametersInQuerystring).length === 0) {
			return path
		}

		return path + '?' + stringifyQuerystring(parametersInQuerystring)
	}

	function getParametersWithoutMatchingToken(parameters, tokenArray) {
		var tokenHash = tokenArray.reduce(function(memo, bit) {
			if (!bit.string) {
				memo[bit.name] = bit;
			}
			return memo
		}, {});

		return Object.keys(parameters).filter(function(param) {
			return !tokenHash[param]
		}).reduce(function(newParameters, param) {
			newParameters[param] = parameters[param];
			return newParameters
		}, {})
	}

	var browser = function (fn) {
	  typeof setImmediate === 'function' ?
	    setImmediate(fn) :
	    setTimeout(fn, 0);
	};

	function _interopDefault$1 (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

	var combineArrays$1 = _interopDefault$1(combineArrays);
	var pathToRegexpWithReversibleKeys$1 = _interopDefault$1(pathToRegexpWithReversibleKeys);
	var thenDenodeify$1 = _interopDefault$1(thenDenodeify);
	var eventemitter3$1 = _interopDefault$1(eventemitter3);
	var hashBrownRouter$1 = _interopDefault$1(hashBrownRouter);
	var pagePathBuilder$1 = _interopDefault$1(pagePathBuilder);
	var isoNextTick = _interopDefault$1(browser);

	function createCommonjsModule$1(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var stateStringParser = createCommonjsModule$1(function (module) {
		module.exports = function (stateString) {
			return stateString.split('.').reduce(function (stateNames, latestNameChunk) {
				stateNames.push(stateNames.length ? stateNames[stateNames.length - 1] + '.' + latestNameChunk : latestNameChunk);

				return stateNames;
			}, []);
		};
	});

	var stateState = function StateState() {
		var states = {};

		function getHierarchy(name) {
			var names = stateStringParser(name);

			return names.map(function (name) {
				if (!states[name]) {
					throw new Error('State ' + name + ' not found');
				}
				return states[name];
			});
		}

		function getParent(name) {
			var parentName = getParentName(name);

			return parentName && states[parentName];
		}

		function getParentName(name) {
			var names = stateStringParser(name);

			if (names.length > 1) {
				var secondToLast = names.length - 2;

				return names[secondToLast];
			} else {
				return null;
			}
		}

		function guaranteeAllStatesExist(newStateName) {
			var stateNames = stateStringParser(newStateName);
			var statesThatDontExist = stateNames.filter(function (name) {
				return !states[name];
			});

			if (statesThatDontExist.length > 0) {
				throw new Error('State ' + statesThatDontExist[statesThatDontExist.length - 1] + ' does not exist');
			}
		}

		function buildFullStateRoute(stateName) {
			return getHierarchy(stateName).map(function (state) {
				return '/' + (state.route || '');
			}).join('').replace(/\/{2,}/g, '/');
		}

		function applyDefaultChildStates(stateName) {
			var state = states[stateName];

			var defaultChildStateName = state && (typeof state.defaultChild === 'function' ? state.defaultChild() : state.defaultChild);

			if (!defaultChildStateName) {
				return stateName;
			}

			var fullStateName = stateName + '.' + defaultChildStateName;

			return applyDefaultChildStates(fullStateName);
		}

		return {
			add: function add(name, state) {
				states[name] = state;
			},
			get: function get(name) {
				return name && states[name];
			},

			getHierarchy: getHierarchy,
			getParent: getParent,
			getParentName: getParentName,
			guaranteeAllStatesExist: guaranteeAllStatesExist,
			buildFullStateRoute: buildFullStateRoute,
			applyDefaultChildStates: applyDefaultChildStates
		};
	};

	var extend$1 = function extend() {
	  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
	    args[_key] = arguments[_key];
	  }

	  return Object.assign.apply(Object, [{}].concat(args));
	};

	var stateComparison_1 = function StateComparison(stateState) {
		var getPathParameters = pathParameters();

		var parametersChanged = function parametersChanged(args) {
			return parametersThatMatterWereChanged(extend$1(args, { stateState: stateState, getPathParameters: getPathParameters }));
		};

		return function (args) {
			return stateComparison(extend$1(args, { parametersChanged: parametersChanged }));
		};
	};

	function pathParameters() {
		var parameters = {};

		return function (path) {
			if (!path) {
				return [];
			}

			if (!parameters[path]) {
				parameters[path] = pathToRegexpWithReversibleKeys$1(path).keys.map(function (key) {
					return key.name;
				});
			}

			return parameters[path];
		};
	}

	function parametersThatMatterWereChanged(_ref) {
		var stateState = _ref.stateState,
		    getPathParameters = _ref.getPathParameters,
		    stateName = _ref.stateName,
		    fromParameters = _ref.fromParameters,
		    toParameters = _ref.toParameters;

		var state = stateState.get(stateName);
		var querystringParameters = state.querystringParameters || [];
		var parameters = getPathParameters(state.route).concat(querystringParameters);

		return Array.isArray(parameters) && parameters.some(function (key) {
			return fromParameters[key] !== toParameters[key];
		});
	}

	function stateComparison(_ref2) {
		var parametersChanged = _ref2.parametersChanged,
		    original = _ref2.original,
		    destination = _ref2.destination;

		var states = combineArrays$1({
			start: stateStringParser(original.name),
			end: stateStringParser(destination.name)
		});

		return states.map(function (_ref3) {
			var start = _ref3.start,
			    end = _ref3.end;
			return {
				nameBefore: start,
				nameAfter: end,
				stateNameChanged: start !== end,
				stateParametersChanged: start === end && parametersChanged({
					stateName: start,
					fromParameters: original.parameters,
					toParameters: destination.parameters
				})
			};
		});
	}

	var currentState = function CurrentState() {
		var current = {
			name: '',
			parameters: {}
		};

		return {
			get: function get() {
				return current;
			},
			set: function set(name, parameters) {
				current = {
					name: name,
					parameters: parameters
				};
			}
		};
	};

	var stateChangeLogic = function stateChangeLogic(stateComparisonResults) {
		var hitChangingState = false;
		var hitDestroyedState = false;

		var output = {
			destroy: [],
			change: [],
			create: []
		};

		stateComparisonResults.forEach(function (state) {
			hitChangingState = hitChangingState || state.stateParametersChanged;
			hitDestroyedState = hitDestroyedState || state.stateNameChanged;

			if (state.nameBefore) {
				if (hitDestroyedState) {
					output.destroy.push(state.nameBefore);
				} else if (hitChangingState) {
					output.change.push(state.nameBefore);
				}
			}

			if (state.nameAfter && hitDestroyedState) {
				output.create.push(state.nameAfter);
			}
		});

		return output;
	};

	var stateTransitionManager = function stateTransitionManager(emitter) {
		var currentTransitionAttempt = null;
		var nextTransition = null;

		function doneTransitioning() {
			currentTransitionAttempt = null;
			if (nextTransition) {
				beginNextTransitionAttempt();
			}
		}

		var isTransitioning = function isTransitioning() {
			return !!currentTransitionAttempt;
		};

		function beginNextTransitionAttempt() {
			currentTransitionAttempt = nextTransition;
			nextTransition = null;
			currentTransitionAttempt.beginStateChange();
		}

		function cancelCurrentTransition() {
			currentTransitionAttempt.transition.cancelled = true;
			var err = new Error('State transition cancelled by the state transition manager');
			err.wasCancelledBySomeoneElse = true;
			emitter.emit('stateChangeCancelled', err);
		}

		emitter.on('stateChangeAttempt', function (beginStateChange) {
			nextTransition = createStateTransitionAttempt(beginStateChange);

			if (isTransitioning() && currentTransitionAttempt.transition.cancellable) {
				cancelCurrentTransition();
			} else if (!isTransitioning()) {
				beginNextTransitionAttempt();
			}
		});

		emitter.on('stateChangeError', doneTransitioning);
		emitter.on('stateChangeCancelled', doneTransitioning);
		emitter.on('stateChangeEnd', doneTransitioning);

		function createStateTransitionAttempt(_beginStateChange) {
			var transition = {
				cancelled: false,
				cancellable: true
			};
			return {
				transition: transition,
				beginStateChange: function beginStateChange() {
					for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
						args[_key] = arguments[_key];
					}

					return _beginStateChange.apply(undefined, [transition].concat(args));
				}
			};
		}
	};

	var defaultRouterOptions = { reverse: false };

	// Pulled from https://github.com/joliss/promise-map-series and prettied up a bit

	var promiseMapSeries = function sequence(array, iterator) {
		var currentPromise = Promise.resolve();
		return Promise.all(array.map(function (value, i) {
			return currentPromise = currentPromise.then(function () {
				return iterator(value, i, array);
			});
		}));
	};

	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
	  return typeof obj;
	} : function (obj) {
	  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};

	var getProperty = function getProperty(name) {
		return function (obj) {
			return obj[name];
		};
	};
	var reverse = function reverse(ary) {
		return ary.slice().reverse();
	};
	var isFunction = function isFunction(property) {
		return function (obj) {
			return typeof obj[property] === 'function';
		};
	};
	var isThenable = function isThenable(object) {
		return object && ((typeof object === 'undefined' ? 'undefined' : _typeof(object)) === 'object' || typeof object === 'function') && typeof object.then === 'function';
	};
	var promiseMe = function promiseMe(fn) {
		for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
			args[_key - 1] = arguments[_key];
		}

		return new Promise(function (resolve) {
			return resolve(fn.apply(undefined, args));
		});
	};

	var expectedPropertiesOfAddState = ['name', 'route', 'defaultChild', 'data', 'template', 'resolve', 'activate', 'querystringParameters', 'defaultQuerystringParameters', 'defaultParameters'];

	var abstractStateRouter = function StateProvider(makeRenderer, rootElement) {
		var stateRouterOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

		var prototypalStateHolder = stateState();
		var lastCompletelyLoadedState = currentState();
		var lastStateStartedActivating = currentState();
		var stateProviderEmitter = new eventemitter3$1();
		var compareStartAndEndStates = stateComparison_1(prototypalStateHolder);

		var stateNameToArrayofStates = function stateNameToArrayofStates(stateName) {
			return stateStringParser(stateName).map(prototypalStateHolder.get);
		};

		stateTransitionManager(stateProviderEmitter);

		var _extend = extend$1({
			throwOnError: true,
			pathPrefix: '#'
		}, stateRouterOptions),
		    throwOnError = _extend.throwOnError,
		    pathPrefix = _extend.pathPrefix;

		var router = stateRouterOptions.router || hashBrownRouter$1(defaultRouterOptions);

		router.on('not found', function (route, parameters) {
			stateProviderEmitter.emit('routeNotFound', route, parameters);
		});

		var destroyDom = null;
		var getDomChild = null;
		var renderDom = null;
		var resetDom = null;

		var activeStateResolveContent = {};
		var activeDomApis = {};
		var activeEmitters = {};

		function handleError(event, err) {
			isoNextTick(function () {
				stateProviderEmitter.emit(event, err);
				console.error(event + ' - ' + err.message);
				if (throwOnError) {
					throw err;
				}
			});
		}

		function destroyStateName(stateName) {
			var state = prototypalStateHolder.get(stateName);
			stateProviderEmitter.emit('beforeDestroyState', {
				state: state,
				domApi: activeDomApis[stateName]
			});

			activeEmitters[stateName].emit('destroy');
			activeEmitters[stateName].removeAllListeners();
			delete activeEmitters[stateName];
			delete activeStateResolveContent[stateName];

			return destroyDom(activeDomApis[stateName]).then(function () {
				delete activeDomApis[stateName];
				stateProviderEmitter.emit('afterDestroyState', {
					state: state
				});
			});
		}

		function resetStateName(parameters, stateName) {
			var domApi = activeDomApis[stateName];
			var content = getContentObject(activeStateResolveContent, stateName);
			var state = prototypalStateHolder.get(stateName);

			stateProviderEmitter.emit('beforeResetState', {
				domApi: domApi,
				content: content,
				state: state,
				parameters: parameters
			});

			activeEmitters[stateName].emit('destroy');
			delete activeEmitters[stateName];

			return resetDom({
				domApi: domApi,
				content: content,
				template: state.template,
				parameters: parameters
			}).then(function (newDomApi) {
				if (newDomApi) {
					activeDomApis[stateName] = newDomApi;
				}

				stateProviderEmitter.emit('afterResetState', {
					domApi: activeDomApis[stateName],
					content: content,
					state: state,
					parameters: parameters
				});
			});
		}

		function getChildElementForStateName(stateName) {
			return new Promise(function (resolve) {
				var parent = prototypalStateHolder.getParent(stateName);
				if (parent) {
					var parentDomApi = activeDomApis[parent.name];
					resolve(getDomChild(parentDomApi));
				} else {
					resolve(rootElement);
				}
			});
		}

		function renderStateName(parameters, stateName) {
			return getChildElementForStateName(stateName).then(function (element) {
				var state = prototypalStateHolder.get(stateName);
				var content = getContentObject(activeStateResolveContent, stateName);

				stateProviderEmitter.emit('beforeCreateState', {
					state: state,
					content: content,
					parameters: parameters
				});

				return renderDom({
					template: state.template,
					element: element,
					content: content,
					parameters: parameters
				}).then(function (domApi) {
					activeDomApis[stateName] = domApi;
					stateProviderEmitter.emit('afterCreateState', {
						state: state,
						domApi: domApi,
						content: content,
						parameters: parameters
					});
					return domApi;
				});
			});
		}

		function renderAll(stateNames, parameters) {
			return promiseMapSeries(stateNames, function (stateName) {
				return renderStateName(parameters, stateName);
			});
		}

		function onRouteChange(state, parameters) {
			try {
				var finalDestinationStateName = prototypalStateHolder.applyDefaultChildStates(state.name);

				if (finalDestinationStateName === state.name) {
					emitEventAndAttemptStateChange(finalDestinationStateName, parameters);
				} else {
					// There are default child states that need to be applied

					var theRouteWeNeedToEndUpAt = makePath(finalDestinationStateName, parameters);
					var currentRoute = router.location.get();

					if (theRouteWeNeedToEndUpAt === currentRoute) {
						// the child state has the same route as the current one, just start navigating there
						emitEventAndAttemptStateChange(finalDestinationStateName, parameters);
					} else {
						// change the url to match the full default child state route
						stateProviderEmitter.go(finalDestinationStateName, parameters, { replace: true });
					}
				}
			} catch (err) {
				handleError('stateError', err);
			}
		}

		function addState(state) {
			if (typeof state === 'undefined') {
				throw new Error('Expected \'state\' to be passed in.');
			} else if (typeof state.name === 'undefined') {
				throw new Error('Expected the \'name\' option to be passed in.');
			} else if (typeof state.template === 'undefined') {
				throw new Error('Expected the \'template\' option to be passed in.');
			}
			Object.keys(state).filter(function (key) {
				return expectedPropertiesOfAddState.indexOf(key) === -1;
			}).forEach(function (key) {
				console.warn('Unexpected property passed to addState:', key);
			});

			prototypalStateHolder.add(state.name, state);

			var route = prototypalStateHolder.buildFullStateRoute(state.name);

			router.add(route, function (parameters) {
				return onRouteChange(state, parameters);
			});
		}

		function getStatesToResolve(stateChanges) {
			return stateChanges.change.concat(stateChanges.create).map(prototypalStateHolder.get);
		}

		function emitEventAndAttemptStateChange(newStateName, parameters) {
			stateProviderEmitter.emit('stateChangeAttempt', function stateGo(transition) {
				attemptStateChange(newStateName, parameters, transition);
			});
		}

		function attemptStateChange(newStateName, parameters, transition) {
			function ifNotCancelled(fn) {
				return function () {
					if (transition.cancelled) {
						var err = new Error('The transition to ' + newStateName + ' was cancelled');
						err.wasCancelledBySomeoneElse = true;
						throw err;
					} else {
						return fn.apply(undefined, arguments);
					}
				};
			}

			return promiseMe(prototypalStateHolder.guaranteeAllStatesExist, newStateName).then(function applyDefaultParameters() {
				var state = prototypalStateHolder.get(newStateName);
				var defaultParams = state.defaultParameters || state.defaultQuerystringParameters || {};
				var needToApplyDefaults = Object.keys(defaultParams).some(function missingParameterValue(param) {
					return typeof parameters[param] === 'undefined';
				});

				if (needToApplyDefaults) {
					throw redirector(newStateName, extend$1(defaultParams, parameters));
				}
				return state;
			}).then(ifNotCancelled(function (state) {
				stateProviderEmitter.emit('stateChangeStart', state, parameters, stateNameToArrayofStates(state.name));
				lastStateStartedActivating.set(state.name, parameters);
			})).then(function getStateChanges() {
				var stateComparisonResults = compareStartAndEndStates({
					original: lastCompletelyLoadedState.get(),
					destination: {
						name: newStateName,
						parameters: parameters
					}
				});
				return stateChangeLogic(stateComparisonResults); // { destroy, change, create }
			}).then(ifNotCancelled(function resolveDestroyAndActivateStates(stateChanges) {
				return resolveStates(getStatesToResolve(stateChanges), extend$1(parameters)).catch(function onResolveError(e) {
					e.stateChangeError = true;
					throw e;
				}).then(ifNotCancelled(function destroyAndActivate(stateResolveResultsObject) {
					transition.cancellable = false;

					var activateAll = function activateAll() {
						return activateStates(stateChanges.change.concat(stateChanges.create));
					};

					activeStateResolveContent = extend$1(activeStateResolveContent, stateResolveResultsObject);

					return promiseMapSeries(reverse(stateChanges.destroy), destroyStateName).then(function () {
						return promiseMapSeries(reverse(stateChanges.change), function (stateName) {
							return resetStateName(extend$1(parameters), stateName);
						});
					}).then(function () {
						return renderAll(stateChanges.create, extend$1(parameters)).then(activateAll);
					});
				}));

				function activateStates(stateNames) {
					return stateNames.map(prototypalStateHolder.get).forEach(function (state) {
						var emitter = new eventemitter3$1();
						var context = Object.create(emitter);
						context.domApi = activeDomApis[state.name];
						context.data = state.data;
						context.parameters = parameters;
						context.content = getContentObject(activeStateResolveContent, state.name);
						activeEmitters[state.name] = emitter;

						try {
							state.activate && state.activate(context);
						} catch (e) {
							isoNextTick(function () {
								throw e;
							});
						}
					});
				}
			})).then(function stateChangeComplete() {
				lastCompletelyLoadedState.set(newStateName, parameters);
				try {
					stateProviderEmitter.emit('stateChangeEnd', prototypalStateHolder.get(newStateName), parameters, stateNameToArrayofStates(newStateName));
				} catch (e) {
					handleError('stateError', e);
				}
			}).catch(ifNotCancelled(function handleStateChangeError(err) {
				if (err && err.redirectTo) {
					stateProviderEmitter.emit('stateChangeCancelled', err);
					return stateProviderEmitter.go(err.redirectTo.name, err.redirectTo.params, { replace: true });
				} else if (err) {
					handleError('stateChangeError', err);
				}
			})).catch(function handleCancellation(err) {
				if (err && err.wasCancelledBySomeoneElse) ; else {
					throw new Error('This probably shouldn\'t happen, maybe file an issue or something ' + err);
				}
			});
		}

		function makePath(stateName, parameters, options) {
			function getGuaranteedPreviousState() {
				if (!lastStateStartedActivating.get().name) {
					throw new Error('makePath required a previous state to exist, and none was found');
				}
				return lastStateStartedActivating.get();
			}
			if (options && options.inherit) {
				parameters = extend$1(getGuaranteedPreviousState().parameters, parameters);
			}

			var destinationStateName = stateName === null ? getGuaranteedPreviousState().name : stateName;

			var destinationState = prototypalStateHolder.get(destinationStateName) || {};
			var defaultParams = destinationState.defaultParameters || destinationState.defaultQuerystringParameters;

			parameters = extend$1(defaultParams, parameters);

			prototypalStateHolder.guaranteeAllStatesExist(destinationStateName);
			var route = prototypalStateHolder.buildFullStateRoute(destinationStateName);
			return pagePathBuilder$1(route, parameters || {});
		}

		var defaultOptions = {
			replace: false
		};

		stateProviderEmitter.addState = addState;
		stateProviderEmitter.go = function (newStateName, parameters, options) {
			options = extend$1(defaultOptions, options);
			var goFunction = options.replace ? router.replace : router.go;

			return promiseMe(makePath, newStateName, parameters, options).then(goFunction, function (err) {
				return handleError('stateChangeError', err);
			});
		};
		stateProviderEmitter.evaluateCurrentRoute = function (defaultState, defaultParams) {
			return promiseMe(makePath, defaultState, defaultParams).then(function (defaultPath) {
				router.evaluateCurrent(defaultPath);
			}).catch(function (err) {
				return handleError('stateError', err);
			});
		};
		stateProviderEmitter.makePath = function (stateName, parameters, options) {
			return pathPrefix + makePath(stateName, parameters, options);
		};
		stateProviderEmitter.stateIsActive = function (stateName) {
			var parameters = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

			var currentState$$1 = lastCompletelyLoadedState.get();
			var stateNameMatches = currentState$$1.name === stateName || currentState$$1.name.indexOf(stateName + '.') === 0;
			var parametersWereNotPassedIn = !parameters;

			return stateNameMatches && (parametersWereNotPassedIn || Object.keys(parameters).every(function (key) {
				return parameters[key] === currentState$$1.parameters[key];
			}));
		};

		var renderer = makeRenderer(stateProviderEmitter);

		destroyDom = thenDenodeify$1(renderer.destroy);
		getDomChild = thenDenodeify$1(renderer.getChildElement);
		renderDom = thenDenodeify$1(renderer.render);
		resetDom = thenDenodeify$1(renderer.reset);

		return stateProviderEmitter;
	};

	function getContentObject(stateResolveResultsObject, stateName) {
		var allPossibleResolvedStateNames = stateStringParser(stateName);

		return allPossibleResolvedStateNames.filter(function (stateName) {
			return stateResolveResultsObject[stateName];
		}).reduce(function (obj, stateName) {
			return extend$1(obj, stateResolveResultsObject[stateName]);
		}, {});
	}

	function redirector(newStateName, parameters) {
		return {
			redirectTo: {
				name: newStateName,
				params: parameters
			}
		};
	}

	// { [stateName]: resolveResult }
	function resolveStates(states, parameters) {
		var statesWithResolveFunctions = states.filter(isFunction('resolve'));
		var stateNamesWithResolveFunctions = statesWithResolveFunctions.map(getProperty('name'));

		var resolves = Promise.all(statesWithResolveFunctions.map(function (state) {
			return new Promise(function (resolve, reject) {
				var resolveCb = function resolveCb(err, content) {
					return err ? reject(err) : resolve(content);
				};

				resolveCb.redirect = function (newStateName, parameters) {
					reject(redirector(newStateName, parameters));
				};

				var res = state.resolve(state.data, parameters, resolveCb);
				if (isThenable(res)) {
					resolve(res);
				}
			});
		}));

		return resolves.then(function (resolveResults) {
			return combineArrays$1({
				stateName: stateNamesWithResolveFunctions,
				resolveResult: resolveResults
			}).reduce(function (obj, result) {
				obj[result.stateName] = result.resolveResult;
				return obj;
			}, {});
		});
	}

	var bundle = abstractStateRouter;

	var deepmerge = createCommonjsModule(function (module, exports) {
	(function (root, factory) {
	    if (typeof undefined === 'function' && undefined.amd) {
	        undefined(factory);
	    } else {
	        module.exports = factory();
	    }
	}(commonjsGlobal, function () {

	function isMergeableObject(val) {
	    var nonNullObject = val && typeof val === 'object';

	    return nonNullObject
	        && Object.prototype.toString.call(val) !== '[object RegExp]'
	        && Object.prototype.toString.call(val) !== '[object Date]'
	}

	function emptyTarget(val) {
	    return Array.isArray(val) ? [] : {}
	}

	function cloneIfNecessary(value, optionsArgument) {
	    var clone = optionsArgument && optionsArgument.clone === true;
	    return (clone && isMergeableObject(value)) ? deepmerge(emptyTarget(value), value, optionsArgument) : value
	}

	function defaultArrayMerge(target, source, optionsArgument) {
	    var destination = target.slice();
	    source.forEach(function(e, i) {
	        if (typeof destination[i] === 'undefined') {
	            destination[i] = cloneIfNecessary(e, optionsArgument);
	        } else if (isMergeableObject(e)) {
	            destination[i] = deepmerge(target[i], e, optionsArgument);
	        } else if (target.indexOf(e) === -1) {
	            destination.push(cloneIfNecessary(e, optionsArgument));
	        }
	    });
	    return destination
	}

	function mergeObject(target, source, optionsArgument) {
	    var destination = {};
	    if (isMergeableObject(target)) {
	        Object.keys(target).forEach(function (key) {
	            destination[key] = cloneIfNecessary(target[key], optionsArgument);
	        });
	    }
	    Object.keys(source).forEach(function (key) {
	        if (!isMergeableObject(source[key]) || !target[key]) {
	            destination[key] = cloneIfNecessary(source[key], optionsArgument);
	        } else {
	            destination[key] = deepmerge(target[key], source[key], optionsArgument);
	        }
	    });
	    return destination
	}

	function deepmerge(target, source, optionsArgument) {
	    var array = Array.isArray(source);
	    var options = optionsArgument || { arrayMerge: defaultArrayMerge };
	    var arrayMerge = options.arrayMerge || defaultArrayMerge;

	    if (array) {
	        return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : cloneIfNecessary(source, optionsArgument)
	    } else {
	        return mergeObject(target, source, optionsArgument)
	    }
	}

	deepmerge.all = function deepmergeAll(array, optionsArgument) {
	    if (!Array.isArray(array) || array.length < 2) {
	        throw new Error('first argument should be an array with at least two elements')
	    }

	    // we are sure there are at least 2 values, so it is safe to have no initial value
	    return array.reduce(function(prev, next) {
	        return deepmerge(prev, next, optionsArgument)
	    })
	};

	return deepmerge

	}));
	});

	var bundle$1 = function SvelteStateRendererFactory() {
		var defaultOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		return function makeRenderer(stateRouter) {
			var asr = {
				makePath: stateRouter.makePath,
				stateIsActive: stateRouter.stateIsActive
			};

			function render(context, cb) {
				var target = context.element,
				    template = context.template,
				    content = context.content;


				var rendererSuppliedOptions = deepmerge(defaultOptions, {
					target: target,
					data: Object.assign(content, defaultOptions.data, { asr: asr })
				});

				function construct(component, options) {
					return options.methods ? instantiateWithMethods(component, options, options.methods) : new component(options);
				}

				var svelte = void 0;

				try {
					if (typeof template === "function") {
						svelte = construct(template, rendererSuppliedOptions);
					} else {
						var options = deepmerge(rendererSuppliedOptions, template.options);

						svelte = construct(template.component, options);
					}
				} catch (e) {
					cb(e);
					return;
				}

				function onRouteChange() {
					svelte.set({
						asr: asr
					});
				}

				stateRouter.on("stateChangeEnd", onRouteChange);

				svelte.on("destroy", function () {
					stateRouter.removeListener("stateChangeEnd", onRouteChange);
				});

				svelte.mountedToTarget = target;
				cb(null, svelte);
			}

			return {
				render: render,
				reset: function reset(context, cb) {
					var svelte = context.domApi;
					var element = svelte.mountedToTarget;

					svelte.destroy();

					var renderContext = Object.assign({ element: element }, context);

					render(renderContext, cb);
				},
				destroy: function destroy(svelte, cb) {
					svelte.destroy();
					cb();
				},
				getChildElement: function getChildElement(svelte, cb) {
					try {
						var element = svelte.mountedToTarget;
						var child = element.querySelector("uiView");
						cb(null, child);
					} catch (e) {
						cb(e);
					}
				}
			};
		};
	};

	function instantiateWithMethods(Component, options, methods) {
		// const coolPrototype = Object.assign(Object.create(Component.prototype), methods)
		// return Component.call(coolPrototype, options)
		return Object.assign(new Component(options), methods);
	}

	var sausageRouter = function SausageLocation(root) {
		var emitter = new eventemitter3();
		var last = '';
		root = root || '';

		window.addEventListener('popstate', function() {
			if (last !== emitter.get()) {
				last = emitter.get();
				emitter.emit('hashchange');
			}
		});

		function stateChange(functionName, newPath) {
			if (last !== newPath) {
				history[functionName]({}, '', joinPath(root, newPath));
				last = newPath;
				emitter.emit('hashchange');
			}
		}

		emitter.go = function(newPath) {
			stateChange('pushState', newPath);
		};

		emitter.replace = function(newPath) {
			stateChange('replaceState', newPath);
		};
		emitter.get = get$1;

		return emitter
	};

	function get$1() {
		return decodeURI(window.location.pathname) + window.location.search
	}

	function joinPath(first, second) {
		var slashlessFirst = trimSlashes(first);
		var slashlessSecond = trimSlashes(second);

		if (slashlessFirst && slashlessSecond) {
			return '/' + slashlessFirst + '/' + slashlessSecond
		} else if (slashlessFirst) {
			return '/' + slashlessFirst
		} else {
			return '/' + slashlessSecond
		}
	}

	function trimSlashes(pathChunk) {
		return pathChunk.replace(/^\/|\/$/g, '')
	}

	const renderer = bundle$1();
	const router = bundle(renderer, document.querySelector("body"), {
	    pathPrefix  : "",
	    router      : hashBrownRouter(sausageRouter())
	});

	function noop() {}

	function assign(tar, src) {
		for (var k in src) tar[k] = src[k];
		return tar;
	}

	function assignTrue(tar, src) {
		for (var k in src) tar[k] = 1;
		return tar;
	}

	function appendNode(node, target) {
		target.appendChild(node);
	}

	function insertNode(node, target, anchor) {
		target.insertBefore(node, anchor);
	}

	function detachNode(node) {
		node.parentNode.removeChild(node);
	}

	function createElement(name) {
		return document.createElement(name);
	}

	function createText(data) {
		return document.createTextNode(data);
	}

	function getSpreadUpdate(levels, updates) {
		var update = {};

		var to_null_out = {};
		var accounted_for = {};

		var i = levels.length;
		while (i--) {
			var o = levels[i];
			var n = updates[i];

			if (n) {
				for (var key in o) {
					if (!(key in n)) to_null_out[key] = 1;
				}

				for (var key in n) {
					if (!accounted_for[key]) {
						update[key] = n[key];
						accounted_for[key] = 1;
					}
				}

				levels[i] = n;
			} else {
				for (var key in o) {
					accounted_for[key] = 1;
				}
			}
		}

		for (var key in to_null_out) {
			if (!(key in update)) update[key] = undefined;
		}

		return update;
	}

	function blankObject() {
		return Object.create(null);
	}

	function destroy(detach) {
		this.destroy = noop;
		this.fire('destroy');
		this.set = noop;

		this._fragment.d(detach !== false);
		this._fragment = null;
		this._state = {};
	}

	function _differs(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function fire(eventName, data) {
		var handlers =
			eventName in this._handlers && this._handlers[eventName].slice();
		if (!handlers) return;

		for (var i = 0; i < handlers.length; i += 1) {
			var handler = handlers[i];

			if (!handler.__calling) {
				handler.__calling = true;
				handler.call(this, data);
				handler.__calling = false;
			}
		}
	}

	function get$2() {
		return this._state;
	}

	function init(component, options) {
		component._handlers = blankObject();
		component._bind = options._bind;

		component.options = options;
		component.root = options.root || component;
		component.store = component.root.store || options.store;
	}

	function on(eventName, handler) {
		var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
		handlers.push(handler);

		return {
			cancel: function() {
				var index = handlers.indexOf(handler);
				if (~index) handlers.splice(index, 1);
			}
		};
	}

	function set(newState) {
		this._set(assign({}, newState));
		if (this.root._lock) return;
		this.root._lock = true;
		callAll(this.root._beforecreate);
		callAll(this.root._oncreate);
		callAll(this.root._aftercreate);
		this.root._lock = false;
	}

	function _set(newState) {
		var oldState = this._state,
			changed = {},
			dirty = false;

		for (var key in newState) {
			if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
		}
		if (!dirty) return;

		this._state = assign(assign({}, oldState), newState);
		this._recompute(changed, this._state);
		if (this._bind) this._bind(changed, this._state);

		if (this._fragment) {
			this.fire("state", { changed: changed, current: this._state, previous: oldState });
			this._fragment.p(changed, this._state);
			this.fire("update", { changed: changed, current: this._state, previous: oldState });
		}
	}

	function callAll(fns) {
		while (fns && fns.length) fns.shift()();
	}

	function _mount(target, anchor) {
		this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
	}

	var proto = {
		destroy,
		get: get$2,
		fire,
		on,
		set,
		_recompute: noop,
		_set,
		_mount,
		_differs
	};

	/* src\Layout.html generated by Svelte v2.6.3 */

	function onstate({ changed, current }) {
	    console.log(changed, current);
	}
	function create_main_fragment(component, ctx) {
		var h1, text, text_1_value = ctx.Date.now(), text_1, text_2, text_3, div;

		var switch_instance_spread_levels = [
			ctx.props
		];

		var switch_value = ctx.Page;

		function switch_props(ctx) {
			var switch_instance_initial_data = {};
			for (var i = 0; i < switch_instance_spread_levels.length; i += 1) {
				switch_instance_initial_data = assign(switch_instance_initial_data, switch_instance_spread_levels[i]);
			}
			return {
				root: component.root,
				data: switch_instance_initial_data
			};
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		return {
			c() {
				h1 = createElement("h1");
				text = createText("Layout! ");
				text_1 = createText(text_1_value);
				text_2 = createText("\r\n\r\n");
				if (switch_instance) switch_instance._fragment.c();
				text_3 = createText("\r\n\r\n");
				div = createElement("div");
				div.textContent = "FOOTER!";
			},

			m(target, anchor) {
				insertNode(h1, target, anchor);
				appendNode(text, h1);
				appendNode(text_1, h1);
				insertNode(text_2, target, anchor);

				if (switch_instance) {
					switch_instance._mount(target, anchor);
				}

				insertNode(text_3, target, anchor);
				insertNode(div, target, anchor);
			},

			p(changed, ctx) {
				if ((changed.Date) && text_1_value !== (text_1_value = ctx.Date.now())) {
					text_1.data = text_1_value;
				}

				var switch_instance_changes = changed.props ? getSpreadUpdate(switch_instance_spread_levels, [
					ctx.props
				]) : {};

				if (switch_value !== (switch_value = ctx.Page)) {
					if (switch_instance) switch_instance.destroy();

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));
						switch_instance._fragment.c();
						switch_instance._mount(text_3.parentNode, text_3);
					}
				}

				else if (switch_value) {
					switch_instance._set(switch_instance_changes);
				}
			},

			d(detach) {
				if (detach) {
					detachNode(h1);
					detachNode(text_2);
				}

				if (switch_instance) switch_instance.destroy(detach);
				if (detach) {
					detachNode(text_3);
					detachNode(div);
				}
			}
		};
	}

	function Layout(options) {
		init(this, options);
		this._state = assign({ Date : Date }, options.data);
		this._intro = true;

		this._handlers.state = [onstate];

		if (!options.root) {
			this._oncreate = [];
			this._beforecreate = [];
			this._aftercreate = [];
		}

		this._fragment = create_main_fragment(this, this._state);

		this.root._oncreate.push(() => {
			onstate.call(this, { changed: assignTrue({}, this._state), current: this._state });
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);

			this._lock = true;
			callAll(this._beforecreate);
			callAll(this._oncreate);
			callAll(this._aftercreate);
			this._lock = false;
		}
	}

	assign(Layout.prototype, proto);

	function process(args) {
	    if(typeof args === "string") {
	        return [ args ];
	    }

	    return [ args.name, args.params, args.options ];
	}

	const link = (node, args) => {
	    let state = process(args);
	    
	    const handler = (e) => {
	        e.preventDefault();

	        return router.go(...state);
	    };

	    node.addEventListener("click", handler);
	    node.href = router.makePath(...state);

	    return {
	        update(args) {
	            state = process(args);
	            node.href = router.makePath(...state);
	        },
	        
	        destroy() {
	            node.removeEventListener("click", handler);
	        }
	    };
	};

	/* src\Home.html generated by Svelte v2.6.3 */

	function data() {
		return {
	    links : {
	        page : "page"
	    }
	};
	}

	function create_main_fragment$1(component, ctx) {
		var div, text_1, p, a, link_action;

		return {
			c() {
				div = createElement("div");
				div.textContent = "HOME";
				text_1 = createText("\r\n");
				p = createElement("p");
				a = createElement("a");
				a.textContent = "/Page";
				link_action = link.call(component, a, ctx.links.page) || {};
			},

			m(target, anchor) {
				insertNode(div, target, anchor);
				insertNode(text_1, target, anchor);
				insertNode(p, target, anchor);
				appendNode(a, p);
			},

			p(changed, ctx) {
				if (typeof link_action.update === 'function' && changed.links) {
					link_action.update.call(component, ctx.links.page);
				}
			},

			d(detach) {
				if (detach) {
					detachNode(div);
					detachNode(text_1);
					detachNode(p);
				}

				if (typeof link_action.destroy === 'function') link_action.destroy.call(component);
			}
		};
	}

	function Home(options) {
		init(this, options);
		this._state = assign(data(), options.data);
		this._intro = true;

		this._fragment = create_main_fragment$1(this, this._state);

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}
	}

	assign(Home.prototype, proto);

	/* src\Page.html generated by Svelte v2.6.3 */

	function create_main_fragment$2(component, ctx) {
		var div;

		return {
			c() {
				div = createElement("div");
				div.textContent = "I'm a PAAAAAGE!";
			},

			m(target, anchor) {
				insertNode(div, target, anchor);
			},

			p: noop,

			d(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	function Page(options) {
		init(this, options);
		this._state = assign({}, options.data);
		this._intro = true;

		this._fragment = create_main_fragment$2(this, this._state);

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}
	}

	assign(Page.prototype, proto);

	router.addState({
	    name     : "home",
	    route    : "/",
	    template : {
	        component : Layout,
	        options   : {
	            Page : Home
	        }
	    }
	});

	router.addState({
	    name     : "page",
	    route    : "/page",
	    template : {
	        component : Layout,
	        options   : {
	            Page
	        }
	    }
	});

	router.evaluateCurrentRoute("home");

}());
//# sourceMappingURL=bundle.js.map
