/*
 * Generic shortcuts and helper functions
 */

var win = window;
var doc = document;
var $win = $( win );
var $doc = $( doc );
var extend = $.extend;
var each = $.each;

// Log simple messages with an identifying prefix
var log = function ( msg ) {
    if ( fuzzbox.DEBUG ) {
        win.console.log( 'fuzzbox: ' + msg );
    }
};

var defined = function ( test ) {
    return typeof test !== 'undefined';
};

var capitalize = function ( str ) {
    return str.charAt(0).toUpperCase() + str.substring(1);
};

var animate = function ( $obj, property, value, duration, easing, done ) {

    // Search for transition plugin, fall back to jQuery.animate()
    var animateFunction = $.fn.transition ? 'transition' : 'animate';
    var map = {};
    map[ property ] = value;

    $obj[ animateFunction ]( map, duration, easing, done );
};

// Convenience fading function
var fadeTo = function ( $obj, value, duration, done ) {
    animate( $obj, 'opacity', value, duration, 'linear', done );
};

// Remove element classes with wildcard matching. Optionally add classes.
// https://gist.github.com/1517285
var alterClass = function ( $obj, removals, additions ) {

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

    return ! additions ? self : self.addClass( additions );
};

var defer = function ( callback, timeout ) {
    return setTimeout( callback, timeout || 0 );
};

var createElement = function ( tag ) {
    return doc.createElement( tag );
};

var empty = function () {};

var IE = ( !! win.ActiveXObject && +( /msie\s(\d+)/i.exec( navigator.userAgent )[1] ) ) || NaN;


// Prevent console from crashing old browsers
win.console = win.console || { log: empty, error: empty };


// Object.keys shim.
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

