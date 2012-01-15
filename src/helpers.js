/* Generic shortcuts and helper functions */

var win = window,
	doc = document,
	$win = $( win ),
	$doc = $( doc ),
	extend = $.extend,
	each = $.each,

	// Log simple messages with an identifying prefix
	log = function ( msg ) {
		if ( ! fuzzbox.DEBUG ) { return; }
		win.console.log( 'fuzzbox: ' + msg );
	},

	capitalize = function ( str ) {
		return str.charAt(0).toUpperCase() + str.substring(1);
	},

	// Get vendor specific CSS property names (if any needed)
	getVendorStyleProperty = function ( property ) {

		// Cache onto the function itself
		var self = getVendorStyleProperty;
		self.c = self.c || {};

		if ( property in self.c ) {
			return self.c[ property ];
		}

		var testElemStyle = doc.documentElement.style;

		if ( property in testElemStyle ) {
			self.c[ property ] = property;
			return property;
		}
		else {
			var prefixes = 'Webkit Moz O ms Khtml'.split( ' ' ),
				propertyCap = capitalize( property ),
				i = 0, 
				test;
			for ( ; i < prefixes.length; i++ ) {
				test = prefixes[i] + propertyCap;
				if ( test in testElemStyle ) {
					self.c[ property ] = test;
					return test; 
				}
			}
		}
		self.c[ property ] = null;
		return null;
	},

	// Simple one property animation with CSS transitions, fallback to jQuery JS animation
	animate = function ( $obj, property, value, duration, easing, done ) {
		var done = done || function () {};
		if ( transitionProperty ) {
			$obj.each( function () {
				var el = this,
					$el = $( this ),
					handler = function () {
						el.removeEventListener( transitionEndEvent, handler, false );
						el.style[ transitionProperty ] = '';
						done();
					};
				if ( $el.css( property ) != value ) {
					el.style[ transitionProperty ] = [ 'all', easing, duration + 'ms' ].join( ' ' );
					el.addEventListener( transitionEndEvent, handler, false );
					el.style[ property ] = value;
				}
				else {
					done();
				}
			});
		}
		else {
			var props = {};
			props[property] = value;
			$obj.animate( props, duration, easing, done );
		}
	},

	// Convenience fading function
	fadeTo = function ( $obj, value, duration, done ) {
		animate( $obj, 'opacity', value, duration, 'linear', done );
	},

	// Remove element classes with wildcard matching. Optionally add classes.
	// https://gist.github.com/1517285
	alterClass = function ( $obj, removals, additions ) {

		var self = $obj;

		if ( removals.indexOf( '*' ) === -1 ) {
			// Use native jQuery methods if there is no wildcard matching
			self.removeClass( removals );
			return !additions ? self : self.addClass( additions );
		}

		var patt = new RegExp( '\\s' +
			removals.
			replace( /\*/g, '[A-Za-z0-9-_]+' ).
			split( ' ' ).
			join( '\\s|\\s' ) +
			'\\s', 'g' );

		self.each( function ( i, it ) {
			var cn = ' ' + it.className + ' ';
			while ( patt.test( cn ) ) {
				cn = cn.replace( patt, ' ' );
			}
			it.className = $.trim( cn );
		});

		return !additions ? self : self.addClass( additions );
	},

	defer = function ( callback, timeout ) {
		return setTimeout( callback, timeout || 0 );
	},

	createElement = function ( tag ) {
		return doc.createElement( tag );
	},
	
	empty = function () {};


// Prevent console from crashing old browsers
win.console = win.console || { log: empty, error: empty };


// Object.keys
//     Will not override native or other implementation
Object.keys = Object.keys || function ( obj ) {
	var res = [],
		key;
	for ( key in obj ) {
		if (obj.hasOwnProperty(key)) {
			res.push(key);
		}
	}
	return res;
};

