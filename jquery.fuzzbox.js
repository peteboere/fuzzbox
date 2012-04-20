/*!
 *
 * fuzzbox.js
 *
 * Flexible media lightbox for jQuery
 *
 * Project page: https://github.com/peteboere/fuzzbox
 * License: http://www.opensource.org/licenses/mit-license.php
 * Copyright: (c) 2012 Pete Boere
 *
 */
(function ($) { // start outer closure

/*
 * Generic shortcuts and helper functions 
 */

var win = window,
	doc = document,
	$win = $( win ),
	$doc = $( doc ),
	extend = $.extend,
	each = $.each,

	// Log simple messages with an identifying prefix
	log = function ( msg ) {
		if ( fuzzbox.DEBUG ) {
			win.console.log( 'fuzzbox: ' + msg );
		}
	},

	defined = function ( test ) {
		return typeof test !== 'undefined';
	},

	capitalize = function ( str ) {
		return str.charAt(0).toUpperCase() + str.substring(1);
	},

	animate = function ( $obj, property, value, duration, easing, done ) {

		// Search for transition plugin, fall back to jQuery.animate()
		var animateFunction = $.fn.transition ? 'transition' : 'animate';
		var map = {};
		map[ property ] = value;

		$obj[ animateFunction ]( map, duration, easing, done );
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

		return ! additions ? self : self.addClass( additions );
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

/*
 * Constructor
 */

var fuzzbox = $.fuzzbox = function ( options ) {

	var options = this.options = extend( {

		 // 'middle', 'top' or integer (px from top)
		vAlign: 'middle',
		
		// The fade speed during transitions. Set to 0 for no fading transition
		transitionFadeSpeed: 100,
		
		// The theme styling hook
		theme: 'default',
		
		// The template name
		template: 'basic',
		
		// The UI text
		text: settings.text,
		
		// Whether to cycle through items in a loop
		cycle: false,

		// When displaying images shrink wrapper to image dimensions
		exactFit: false,
		
		// Whether clicking outside will not close the box
		closeOnClickOutside: true,

		// Whether pressing escape key will close the box
		closeOnPressEscape: true

	}, options || {} );

};

/*
 * Prototype 
 */

fuzzbox.prototype = {

	// Instance configuration options
	options: {},

	// The current set
	items: [],

	// Ref to previous active item (if any)
	previousItem: null,

	// Ref to current active item
	activeItem: null,

	// Index of current active item
	index: null,

	// The computed box dimensions
	dims: null,

	// Ref to trigger element (if element was trigger)
	trigger: null,
	
	// The template in use
	$template: null,

	open: function ( _options ) {

		var self = this;

		// Extend options
		self.options = options = extend( self.options, _options || {} );

		// Call init (will only apply once)
		fuzzbox.init();

		// Set template
		self.$template = fuzzbox.template[ options.template || 'basic' ];

		// Append content to the inner wrapper
		var $inner = fuzzdom.$inner;
		$inner.append( self.$template );

		// Get standard placeholders
		fuzzdom.$content = $inner.find( '#fzz-content' );
		fuzzdom.$caption = $inner.find( '#fzz-caption' );
		fuzzdom.$previous = $inner.find( '#fzz-previous' );
		fuzzdom.$next = $inner.find( '#fzz-next' );

		// Set UI elements
		fuzzdom.$closeBtn.find( '>span' ).html( options.text.close );
		fuzzdom.$previous.find( '>span' ).html( options.text.previous );
		fuzzdom.$next.find( '>span' ).html( options.text.next );

		// Establish items
		// --------------
		var items = options.items || [],
			hasHtmlOption = 'html' in options;

		// Invocations with 'html' or 'url' arguments have priority over groups of items
		// 'html' argument has priority over 'url'
		if ( hasHtmlOption || options.url ) {
			var it = {
				caption: options.caption,
				mediaArgs: options.mediaArgs,
				element: options.element,
				width: options.width,
				height: options.height
			};
			if ( hasHtmlOption ) {
				it.html = options.html;
			}
			else {
				it.url = options.url;
			}
			items = [it];
		}

		// Filter out items that have no content, empty urls or an indetermined media type
		items = $.grep( items, function ( it, index ) {

			var ok = ( 'html' in it ) || ( it.url && it.url != location.href );
			if ( ! ok ) {
				return false;
			}

			// Get media type
			// --------------
			var el = it.element, // May not be set
				elemFuzzAttributes = getElemFuzzAttributes( el ),
				media;

			// Html override
			if ( 'html' in it ) {
				media = 'html';
			}
			// Test for explicitly set option
			else if ( it.media ) {
				media = it.media;
			}
			// Test for an element attribute
			else if ( elemFuzzAttributes && elemFuzzAttributes.media ) {
				media = elemFuzzAttributes.media;
			}
			// Try to guess media type, fallback to 'html'
			else {
				if ( !( media = _guessMediaType( it.url ) ) ) {
					media = 'html';
				}
			}

			// Assign mediaType object
			it.media = new Media( media );

			// Store attributes
			it.attr = elemFuzzAttributes || {};

			// HTML attribute for html media items
			if ( 'html' === it.media[0] && ! defined( it.html ) && it.attr.html ) {
				it.html = unescape( it.attr.html );
			}

			if ( elemFuzzAttributes ) {
				// Media arguments
				if ( elemFuzzAttributes.mediaArgs ) {
					// Direct arguments override attribute arguments
					it.mediaArgs = extend( {}, elemFuzzAttributes.mediaArgs, it.mediaArgs );
				}
			}
			return !!media;
		});

		// Exit if there's nothing to show
		var itemCount = items.length,
			singleItem = itemCount === 1;
		if ( ! itemCount ) {
			log( 'No items to display' );
			return false;
		}

		// Decorate items
		each( items, function ( index, it ) {
			it.index = index;
			it.group = items;
		});

		// Assign the set
		self.items = items;

		// Get start index
		self.index = options.index || 0;
		if ( self.index > itemCount-1 ) {
			// If specified index is out of range select last index
			self.index = itemCount-1;
		}

		// Set activeItem
		activeItem = self.items[ self.index ];

		// Set active instance
		instance = fuzzbox.instance = this;

		// Set styling hooks
		var theme = ( singleItem && activeItem.attr.theme ) || options.theme || 'default',
			classnames = [
				'fzz-startup',
				'fzz-itemcount-' + self.items.length,
				'fzz-theme-' + $.trim( theme ).split( ' ' ).join( ' fzz-theme-' )
			];
		fuzzdom.$fuzzbox.attr( 'class', classnames.join( ' ' ) );

		// Set wrapper dimensions
		var width = 'width' in options ? options.width : '',
			height = 'height' in options ? options.height : '',
			singleItem = itemCount === 1,
			widthAttr = activeItem.attr.width,
			heightAttr = activeItem.attr.height,
			unitTestPatt = /[^0-9\.]/;

		// If a dimension is not set in options and is a single item, look in item attributes
		if ( ! width && singleItem && widthAttr ) {
			width = unitTestPatt.test( widthAttr ) ? widthAttr : +widthAttr;
		}
		if ( ! height && singleItem && activeItem.attr.height ) {
			height = unitTestPatt.test( heightAttr ) ? heightAttr : +heightAttr;
		}
		// Save computed dims
		self.dims = { width: width, height: height };
		fuzzbox.setDims();

		// Set the state of pagination buttons
		setNextPreviousBtns();

		// Make visible
		fuzzbox._open();

		// open event
		raiseEvent( 'open' );

		// Capture the page focussed element then hand focus over to fuzzbox
		self.trigger = doc.activeElement;
		fuzzdom.$wrapper.focus();

		// Set first item flag true
		firstItem = true;

		// Load the first item, remove startup styling hook when done
		self.loadItem( activeItem, function () {
			alterClass( fuzzdom.$fuzzbox, 'fzz-startup', 'fzz-open' );
			// Set first item flag false
			firstItem = false;
		});

		// Return true to the event handler
		return true;
	},

	loadItem: function ( item, callback ) {

		var self = this,
			contentArea = fuzzdom.$content[0],
			captionArea = fuzzdom.$caption[0];

		// Set activeItem and previousItem
		self.previousItem = previousItem = self.activeItem;
		self.activeItem = activeItem = item;

		// Prepare loading message
		self.prepareLoadMsg();
		
		// Choose handler
		var mediaHandler = null,
			major;

		if ( 'errorMsg' in item ) {
			mediaHandler = 'error';
		}
		else {

			var fullMediaType = item.media.toString(),
				majorMediaType = item.media[0];

			// First try full media type
			if ( fuzzbox.media[ fullMediaType ] ) {
				mediaHandler = fullMediaType;
			}
			// Next try major media type
			else if ( fuzzbox.media[ majorMediaType ] ) {
				mediaHandler = majorMediaType;
			}
			// Fallback
			else {
				mediaHandler = 'html';
			}
		}

		var handler = fuzzbox.media[ mediaHandler ],

			insert = function ( item, mediaHandler ) {

				self.clearContentAreas();

				alterClass( fuzzdom.$fuzzbox, 'fzz-media-*', 
							getMediaClassNames( item.media ).join( ' ' ) );

				handler.insert( item, contentArea, item.mediaArgs || options.mediaArgs || {} );

				// Choose caption and set its content
				var caption = item.caption || self.options.caption,
					element = item.element;
				if ( 'function' === typeof caption ) {
					// May set to undefined if there is no return value
					caption = caption.call( element || {}, item );
				}
				captionArea.innerHTML = caption || ( element && element.title ) || '';

				// Insert event
				raiseEvent( 'insert' );

				// Invoke any additional callback passed in
				callback && callback();

				// Position the hero
				fuzzbox.positionHero();

				// Position the container
				fuzzbox.position();
			};

		// If no loading required just display
		if ( ! handler.load ) {
			self.cancelLoadMsg();
			raiseEvent( 'load' );
			displayItem( function () {
				insert( item, mediaHandler );
			});
		}
		// Load item then display
		else {
			handler.load( item, function () {
				self.cancelLoadMsg();
				raiseEvent( 'load' );
				if ( item.errorMsg ) {
					mediaHandler = 'error'
					handler = fuzzbox.media[ mediaHandler ];
					item.media.update( mediaHandler );
				}
				displayItem( function () {
					insert( item, mediaHandler );
				});
			});
		}

	},

	prepareLoadMsg: function () {
		var self = this;
		self.loadTimer = setTimeout( function () {
			self.showLoadMsg();
		}, settings.preloadDelay );
	},

	cancelLoadMsg: function () {
		// Hide loading message, clear timeout
		var self = this;
		self.hideLoadMsg();
		clearTimeout( self.loadTimer );
	},

	showLoadMsg: function () {
		uiLocked = true;
		fuzzdom.$loading.show();
		fuzzdom.$fuzzbox.addClass( 'fzz-loading' );
		raiseEvent( 'showLoadMsg' );
	},

	hideLoadMsg: function () {
		uiLocked = false;
		fuzzdom.$loading.hide();
		fuzzdom.$fuzzbox.removeClass( 'fzz-loading' );
		raiseEvent( 'hideLoadMsg' );
	},

	disableElement: function ( $el ) {
		$el.addClass( 'disabled' ).attr( 'tabindex', -1 ).blur();
	},

	enableElement: function ( $el ) {
		$el.removeClass( 'disabled' ).removeAttr( 'tabindex' );
	},

	// 'previous', 'next' or a goto integer (not zero index)
	goTo: function ( dest ) {
		var self = this,
			items = self.items,
			lastIndex = items.length-1,
			currentIndex = self.index;

		if ( uiLocked || items.length < 2 ) {
			return;
		}
		
		var cycle = options.cycle,
			newIndex;

		// Previous keyword
		if ( 'previous' == dest ) {
			newIndex = ( currentIndex > 0 ) ? currentIndex - 1 : 0;
			if ( cycle ) {
				newIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
			}
		}
		// Next keyword
		else if ( 'next' == dest ) {
			newIndex = ( currentIndex < lastIndex ) ? currentIndex + 1 : lastIndex;
			if ( cycle ) {
				newIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
			}
		}
		// Integer goto (not zero index)
		else if ( dest > 0 ) {
			dest -= 1;
			newIndex = dest <= lastIndex ? dest : lastIndex;
		}
		else {
			log( 'No destination' );
			return;
		}

		self.index = newIndex;

		setNextPreviousBtns( self );

		self.loadItem( items[ self.index ] );
	},

	next: function () {
		var self = this;
		if ( ! options.cycle && self.index >= self.items.length-1  ) {
			return;
		}
		this.goTo( 'next' );
	},

	previous: function () {
		var self = this;
		if ( ! options.cycle && self.index <= 0 ) {
			return;
		}
		self.goTo( 'previous' );
	},

	close: function () {

		var self = this;

		// Hide the fuzzbox
		fuzzbox._close( function () {

			raiseEvent( 'close' );

			// Hand focus back to the page
			if ( activeItem.element ) {
				activeItem.element.focus()
			}
			else {
				self.trigger && self.trigger.focus();
			}

			self.cleanup();
		});
	},

	cleanup: function () {
		var self = this;
		self.clearContentAreas( true );
		self.enableElement( fuzzdom.$previous );
		self.enableElement( fuzzdom.$next );
		self.cancelLoadMsg();
		
		fuzzdom.$fuzzbox.removeClass( 'fzz-open' );
		
		// Reset wrapper styles; may have been set by dragging
		var style = fuzzdom.$wrapper[0].style;
		style.top =
		style.left = '';
		fuzzbox.instance = instance = null;
	},

	clearContentAreas: function ( all ) {
		
		// If showing consecutive (loaded) images we'll call it a slideshow
		var slideshow =
				previousItem &&
				! previousItem.errorMsg &&
				'image' === previousItem.media[0] &&
				'image' === activeItem.media[0];

		if ( ! slideshow ) {
			fuzzdom.$content.empty();
		}
		
		fuzzdom.$caption.empty();

		// Avoid latency/display problems by reseting src attributes
		fuzzbox.getIframe( false );
		var image = fuzzbox.getImage();
		image.src = image.style.marginTop = '';

		// Reset any vertically centered hero
		fuzzdom.$content.find( '.fzz-hero' ).css( 'margin-top', '' );

		if ( all ) {
			// Clear template area
			fuzzdom.$inner.empty();
		}
	}

};

/*
 * Private class variables and helper functions
 */

	// Shortcut ref to active instance
var instance,

	// Shortcut ref to active item
	activeItem,

	// Shortcut ref to previous item
	previousItem,

	// Flag. Set for first item on launch
	firstItem,

	// Shortcut ref to active instance options
	options,

	// Flag. Lock UI paging controls during transitions
	uiLocked,

	// MediaType:
	//    Flexible objects for storing major and minor media types as one
	Media = function ( media ) {

		var self = this;

		self.update = function ( media ) {
			// A Media object may be passed in, in this case return it
			if ( typeof media !== 'string' ) {
				return media;
			}
			var slash = media.indexOf( '/' );
			self[0] = media;
			self[1] = null;
			if ( slash !== -1 ) {
				self[0] = media.substring( 0, slash );
				self[1] = media.substring( slash+1 );
			}
		};
		self.toString = function () {
			return self[0] + ( self[1] ? '/' + self[1] : '' );
		};

		return self.update( media );
	},

	// Guess a media type from url file extention
	_guessMediaType = function ( url ) {

		var filename = url.toLowerCase(),
			pos = filename.indexOf( '#' ),
			mediaString = null;

		// Discard hash and query parts of url
		if ( pos !== -1 ) {
			filename = filename.substring( 0, pos );
		}
		pos = filename.indexOf( '?' );
		if ( pos !== -1 ) {
			filename = filename.substring( 0, pos );
		}

		// Try to match a file extension, on failure return null
		var fileExt,
			m = /\.([a-z0-9]+)$/.exec( filename.replace( /\/+$/, '' ).toLowerCase() );
		if ( m ) {
			fileExt = m[1];
		}
		else {
			return mediaString;
		}

		// Ascertain a media type based on file extension

		// Images
		if ( m = /^(jpe?g|png|gif|tiff?|webp)$/.exec( fileExt ) ) {
			mediaString = 'image/' + m[1];
		}
		// SVGs
		else if ( /^svgz?$/.test( fileExt ) ) {
			mediaString = 'image/svg';
		}
		// Video
		else if ( /^(webm|ogv|ogg|ogv|mp4|m4v|3gp)?$/.test( fileExt ) ) {
			var minor = 'mp4';
			if ( /^(ogv|ogg|ogm)$/.test( fileExt ) ) {
				minor = 'ogg';
			}
			else if ( 'webm' === fileExt ) {
				minor = 'webm';
			}
			mediaString = 'video/' + minor;
		}
		// Audio
		else if ( m = /^(mp3)?$/.exec( fileExt ) ) {
			mediaString = 'audio/' + m[1];
		}
		// HTML
		else if ( /^html?$/.test( fileExt ) ) {
			mediaString = 'html';
		}

		return mediaString;
	},

	// Parse dom element for fuzz attributes
	getElemFuzzAttributes = function ( element ) {
		if ( ! element ) { return null; }
		var out = {}, prefix = 'data-fzz-';
		// Get all prefixed attributes
		// Then filter into a hash
		each( element.attributes, function ( index, attr ) {
			var name = attr.name,
				pos = name.indexOf( prefix );
			if ( 0 === pos ) {
				name = name.substring( prefix.length );
				var parts = name.split( '-' ),
					prop = parts.shift();
				if ( ! out[prop] && ! parts.length ) {
					out[prop] = attr.value;
				}
				// Only one argument per attribute
				else if ( parts.length ) {
					var args = prop + 'Args';
					out[args] = out[args] || {};
					out[args][parts[0]] = attr.value;
				}
			}
		});
		return out;
	},

	// Create fuzzbox media classnames
	getMediaClassNames = function ( mediaType ) {
		var classnames = [];
		classnames.push( 'fzz-media-' + mediaType[0] );
		classnames.push( 'fzz-media-' + ( mediaType+'' ).replace( /\//, '-' ) );
		return classnames;
	},

	raiseEvent = function ( eventType ) {
		var eventTypeCap = 'on' + capitalize( eventType );
		$doc.trigger( 'fzz_' + eventType );
		instance && instance[eventTypeCap] && instance[eventTypeCap].call( instance );
	},

	// Fade down old item, invoke insertCallback, fadeUp
	displayItem = function ( insertCallback ) {
		var option = 'transitionFadeSpeed',
			transitionFadeSpeed = option in options ? options[ option ] : 0,
			$content = fuzzdom.$content;
		if ( transitionFadeSpeed && ! firstItem ) {
			uiLocked = true;
			fadeTo( $content, 0, transitionFadeSpeed, function () {
				insertCallback();
				defer( function () {
					fadeTo( $content, 1, transitionFadeSpeed, function () {
						uiLocked = false;
					});
				}, 13 );
			});
		}
		else {
			insertCallback();
		}
	},

	setNextPreviousBtns = function () {

		var itemCount = instance.items.length,
			$previous = fuzzdom.$previous,
			$next = fuzzdom.$next;

		if ( itemCount < 2 ) {
			instance.disableElement( $previous );
			instance.disableElement( $next );
		}
		else if ( ! options.cycle ) {
			instance[ ( instance.index > 0 ? 'enable' : 'disable' ) + 'Element' ]( $previous );
			instance[ ( instance.index < itemCount-1 ? 'enable' : 'disable' ) + 'Element' ]( $next );
		}
	};


// http://diveintohtml5.info/video.html
// Video file extentions with their related type/codec identifying strings

var _testVideoFormat = function ( format ) {
		if ( ! format ) {
			return null;
		}
		var v = fuzzbox.getVideo();
		return !!( v.canPlayType && v.canPlayType( format ).replace( /no/, '' ) );
	},
	_formats = {
		video: {
			mp4:  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
			webm: 'video/webm; codecs="vp8, vorbis"',
			ogg:  'video/ogg; codecs="theora, vorbis"'
		},
		audio: {

		}
	};

// Add utilities to the namespace
extend( fuzzbox, {
	Media:           Media,
	guessMediaType:  _guessMediaType,
	formats:         _formats,
	testVideoFormat: _testVideoFormat
});

/*
 * Static methods and properties
 */

// Cache for dom references
// Shortcut into local scope since we use it often
var fuzzdom = fuzzbox.dom = {};

extend( fuzzbox, {

	// Debug mode for logging messages to the console
	DEBUG: false,

	// Status
	opened: false,

	// Reference to active fuzzbox instance (if any)
	instance: null,

	// Inititalization:
	//     Called once on first launch, subsequent calls will return early
	init: function () {

		if ( fuzzbox.initialized ) { return; }

		// Create base html
		var $html = $(
			'<div id="fuzzbox">' +
				'<div id="fzz-overlay"></div>' +
				'<div id="fzz-outer">' +
					'<div id="fzz-wrapper" tabindex="0">' +
						'<div id="fzz-inner"></div>' +
						'<div id="fzz-loading"></div>' +
						'<a id="fzz-close" href="modal:close"><span></span></a>' +
					'</div>' +
				'</div>' +
			'</div>' );

		// Get dom references
		extend( fuzzdom, {
			$fuzzbox    : $html,
			$overlay    : $( '#fzz-overlay', $html ),
			$loading    : $( '#fzz-loading', $html ),
			$outer      : $( '#fzz-outer', $html ),
			$wrapper    : $( '#fzz-wrapper', $html ),
			$inner      : $( '#fzz-inner', $html ),
			$closeBtn   : $( '#fzz-close', $html )
		});

		// Hide the loading screen
		fuzzdom.$loading.hide();

		// Shortcuts
		var $wrapper = fuzzdom.$wrapper;

		// Delegate events
		$wrapper.click( function ( e ) {
			var $target = $( e.target ).closest( 'a' ),
				target = $target[0],
				command = null;

			// Check for pseudo protocol commands:
			//     next, previous, cancel, goto(n), n
			var pseudo = 'modal:',
				commandArg;
			if ( target && target.href && target.href.indexOf( pseudo ) == 0 ) {
				command = target.href.substring( pseudo.length );
				var paren;
				if ( ( paren = command.indexOf( '(' ) ) !== -1 ) {
					commandArg = command.substring( paren ).replace( /[\(\)]/g, '' );
					command = command.substring( 0, paren );
				}
				// Plain integer command is shorthand for goto(n)
				else if ( /^\d$/.test( command ) ) {
					commandArg = command;
					command = 'goto';
				}
			}

			if ( ! command ) {
				return;
			}
			if ( $target.hasClass( 'disabled' ) ) {
				return false;
			}

			switch ( command ) {
				case 'close':
					fuzzbox.close();
					break;
				case 'previous':
					fuzzbox.previous();
					break;
				case 'next':
					fuzzbox.next();
					break;
				case 'goto':
					fuzzbox.goTo( commandArg || 1 );
					break;
			}
			return false;
		});

		// Handle drag
		var dragInfo,
			startDrag = function ( e, $el ) {
				var pageX = e.pageX,
					pageY = e.pageY,
					elWidth = $el.width(),
					offset = $el.offset(),
					left = offset.left,
					top = offset.top,
					startX = parseInt( $el.css( 'left' ), 10 ) || 0,
					startY = parseInt( $el.css( 'top' ), 10 ) || 0,
					handleOffsetX = pageX - left,
					handleOffsetY = pageY - top,
					viewPortWidth = $win.width();
				dragInfo = {
					// Element
					el: {
						T:  top,
						R:  left + elWidth,
						L:  left,
						sX: startX,
						sY: startY,
						// Bounds
						bT: -( top - startY ),
						bL: -( left - startX  ),
						bR: -( left - startX ) + ( viewPortWidth - elWidth )
					},
					// Mouse
					m: {
						sX: pageX,
						sY: pageY,
						// Bounds
						bT: handleOffsetY,
						bR: viewPortWidth - ( elWidth - handleOffsetX ),
						bL: handleOffsetX
					}
				};
				$doc.mousemove( onDragMove );
			},
			onDragMove = function ( e ) {
				var pageX = e.pageX,
					pageY = e.pageY,
					mouse = dragInfo.m,
					el = dragInfo.el,
					wrapper = $wrapper[0],
					style = wrapper.style,
					left, top;

				if ( pageY < mouse.bT ) {
					top = el.bT;
				}
				else {
					top = el.sY + ( pageY - mouse.sY );
				}

				if ( pageX < mouse.bL ) {
					left = el.bL;
				}
				else if ( pageX > mouse.bR ) {
					left = el.bR;
				}
				else {
					left = el.sX + ( pageX - mouse.sX );
				}
				style.top = top + 'px';
				style.left = left + 'px';
			};
		$wrapper.mousedown( function ( e ) {
			var $target = $( e.target );
			if ( $target.hasClass( 'fzz-handle' ) ) {
				startDrag( e, $wrapper );
				$doc.one( 'mouseup blur', function () {
					$doc.unbind( 'mousemove', onDragMove );
				});
				return false;
			}
		});


		// Optionally close by clicking outside the content
		$( [ fuzzdom.$overlay[0], fuzzdom.$outer[0] ] ).click( function ( e ) {
			if ( e.target === this && options.closeOnClickOutside ) {
				fuzzbox.close();
			}
		});

		// Close with escape key
		$doc.keyup( function ( e ) {
			var keycode = e.keyCode || e.which;
			if ( keycode === 27 && fuzzbox.opened && options.closeOnPressEscape ) {
				fuzzbox.close();
			}
		});

		// Keyboard pagination
		$doc.keydown( function ( e ) {
			var keycode = e.keyCode || e.which;
			if ( fuzzbox.opened ) {
				if ( 37 === keycode ) {
					// left
					fuzzbox.previous();
					e.preventDefault();
				}
				else if ( 39 === keycode ) {
					// right
					fuzzbox.next();
					e.preventDefault();
				}
			}
		});

		// Handle window resize events
		$win.resize( function () {
			fuzzbox.position();
			fuzzbox.positionHero();
		});

		// Hide initially
		fuzzdom.$fuzzbox.hide();

		// Append to the dom
		$( 'body' ).append( fuzzbox.dom.$fuzzbox );

		// Call any init event handlers
		raiseEvent( 'init' );

		// Flag as done
		fuzzbox.initialized = true;
	},


	// Internal open method
	_open: function () {

		var $fuzzbox = fuzzdom.$fuzzbox;

		$fuzzbox.show();
		fuzzbox.position();
		fuzzbox.opened = true;
	},

	// Internal close method
	_close: function ( callback ) {

		var $fuzzbox = fuzzdom.$fuzzbox;

		fadeTo( $fuzzbox, 0, settings.fadeSpeed, function () {
			$fuzzbox.hide().css( 'opacity', '' );
			callback && callback();
		});

		fuzzbox.opened = false;
	},

	// Open statically
	open: function ( options ) {
		return !( new fuzzbox( options ).open() );
	},

	// Close active instance
	close: function () {
		instance && instance.close();
	},

	// Active instance previous
	previous: function () {
		instance && instance.previous();
	},

	// Active instance next
	next: function () {
		instance && instance.next();
	},

	// Active instance goTo
	goTo: function ( dest ) {
		instance && instance.goTo( dest );
	},

	position: function () {
		var outer = fuzzdom.$outer[0],
			outerHeight = outer.offsetHeight,
			viewportHeight = $win.height(),
			scrollTop = $win.scrollTop(),
			top = 0,
			vAlign = options.vAlign;

		if ( 'middle' === vAlign ) {
			if ( viewportHeight > outerHeight ) {
				top = ( viewportHeight - outerHeight ) / 2;
			}
		}
		else if ( 'top' === vAlign ) {
			// Do nothing since top is 0 by default
		}
		else if ( +vAlign ) {
			// Integer value
			top = vAlign;
		}

		top += scrollTop;
		outer.style.top = top + 'px';
	},

	positionHero: function () {

		// If hero object is in the content area we'll center it vertically
		var $hero = fuzzdom.$content.find( '.fzz-hero' );

		if ( $hero.length ) {
			var hero = $hero[0],
				diff = fuzzdom.$content[0].offsetHeight - hero.offsetHeight;
			if ( diff > 0 ) {
				hero.style.marginTop = ( diff / 2 ) + 'px';
			}
		}
	},

	loadUrl: function ( url, item, callback ) {
		// Html resources
		$.ajax({
			url: url,
			success: function ( data ) {
				item.html = data;
				callback( item );
			},
			error: function ( jqxhr, status ) {
				item.errorMsg = status;
				callback( item );
			}
		});
	},

	loadImage: function ( url, item, callback ) {
		// Images and svgs
		var img = new Image;
		img.onload = function () {
			item.image = img;
			callback( item );
		};
		img.onabort =
		img.onerror = function ( e ) {
			e = e || window.event;
			item.errorMsg = e.type + ' loading image: "' + url + '"';
			callback( item );
		};
		img.src = url;
	},


	// Creating some objects can be expensive
	getIframe: function ( reset ) {
		var iframe = fuzzdom.iframe;
		if ( false === reset ) {
			iframe && ( iframe.src = '' );
			return;
		}
		if ( ! iframe ) {
			iframe = fuzzdom.iframe = createElement( 'iframe' );
		}
		$( iframe ).attr({
			'class' : 'fzz-hero',
			'frameborder': 0,
			'width':  '100%',
			'height': '100%'
		});
		return iframe;
	},

	getVideo: function () {
		var video = fuzzdom.video;
		if ( ! video ) {
			video = fuzzdom.video = createElement( 'video' );
			video.className = 'fzz-hero';
		}
		return video;
	},

	getAudio: function () {
		var audio = fuzzdom.audio;
		if ( ! audio ) {
			audio = fuzzdom.audio = createElement( 'audio' );
			audio.className = 'fzz-hero';
		}
		return audio;
	},

	getImage: function ( reset ) {
		var image = fuzzdom.image;
		if ( ! image ) {
			image = fuzzdom.image = createElement( 'img' );
			image.className = 'fzz-hero';
		}
		return image;
	},

	setDims: function ( width, height, fixedHeight ) {
		var heightMap, widthMap;
		if ( ! arguments.length ) {
			// If no arguments given restore dimensions to their original height
			widthMap = {
				'max-width': instance.dims.width || ''
			};
			heightMap = {
				'min-height': instance.dims.height || '',
				'max-height': ''
			};
		}
		else {
			widthMap = {
				'max-width': width || ''
			};
			heightMap = {
				'min-height': instance.dims.height || '',
				'max-height': ''
			};
			heightMap[ ( fixedHeight ? 'max' : 'min' ) + '-height' ] = height || '';
		}
		fuzzdom.$content.css( heightMap );
		fuzzdom.$wrapper.css( widthMap );
	},

	markdown: function ( string ) {
		return $.trim( ( ' ' + string + ' ' ).
			replace( /([^_\w])_([^_]+)_([^_\w])/g, function ( full, m1, m2, m3 ) {
				return m1 + '<i>' + m2 + '</i>' + m3;
			}).
			replace( /([^\*\w])\*([^\*]+)\*([^\*\w])/g, function ( full, m1, m2, m3 ) {
				return m1 + '<b>' + m2 + '</b>' + m3;
			}));
	},

	// Templates:
	//     These can be extended, one compulsory element with the id 'fzz-content'
	template: {

		basic : $(
			'<div id="fzz-handle" class="fzz-handle"></div>' +
			'<div id="fzz-content"></div>' +
			'<div id="fzz-caption"></div>' +
			'<a id="fzz-previous" href="modal:previous"><span></span></a>' +
			'<a id="fzz-next" href="modal:next"><span></span></a>' )
	},

	// Media handlers
	media: {

		error: {
			insert: function ( item, contentArea, args ) {
				contentArea.innerHTML = '<p class="fzz-hero">' + item.errorMsg + '</p>';
			}
		},

		html: {
			load: function ( item, done, args ) {
				if ( ! defined( item.html ) && item.url ) {
					fuzzbox.loadUrl( item.url, item, function ( item ) {
						done( item.errorMsg );
					});
				}
				else {
					done();
				}
			},
			insert: function ( item, contentArea, args ) {
				// Optionally filter the html by selector
				if ( args.target ) {
					var root = createElement( 'div' );
					root.innerHTML = item.html;
					item.html = $( root ).find( args.target ).html();
				}
				contentArea.innerHTML = item.html;
			}
		},

		image: {
			load: function ( item, done, args ) {
				fuzzbox.loadImage( item.url, item, function ( item ) {
					done( item.errorMsg );
				});
			},
			insert: function ( item, contentArea, args ) {
				var image = fuzzbox.getImage();
				if ( ! image.parentNode ) {
					contentArea.appendChild( image );
				}
				image.src = item.image.src;

				// Shrink wrap to image dimensions (using max-width/max-height)
				if ( options.exactFit ) {
					fuzzbox.setDims( image.width, image.height, true );
				}
			}
		},

		iframe: {
			insert: function ( item, contentArea, args ) {
				var iframe = fuzzbox.getIframe(),
					width = ( 'width' in args ) ? args.width : '100%',
					height = ( 'height' in args ) ? args.height : '100%',
					opts = {
						src   : item.url || args.url,
						width : width,
						height: height
					};
				delete args.url;
				delete args.src;
				$.extend( opts, args );
				$( iframe ).attr( opts );
				contentArea.appendChild( iframe );
			}
		},

		// video: {
		// 	insert: function ( item, contentArea, args ) {
		// 		var video = fuzzbox.getVideo(),
		// 			attrs = {
		// 				width :   'width' in args ? args.width : '100%',
		// 				height:   'height' in args ? args.height : '100%',
		// 				poster:   args.poster || null,
		// 				// Boolean attributes
		// 				autoplay: 'autoplay' in args ? true : null,
		// 				controls: 'controls' in args ? true : null,
		// 				loop:     'loop' in args ? true : null,
		// 				muted:    'muted' in args ? true : null
		// 			},
		// 			$video = $( video );
		// 		$video.attr( attrs );
		// 
		// 		var videoType = item.media[1],
		// 			formats = fuzzbox.formats.video,
		// 			format = videoType && formats[videoType],
		// 			source;
		// 
		// 		if ( _testVideoFormat( format ) ) {
		// 			source = $( '<source/>' ).attr({
		// 				type: format,
		// 				src:  item.url
		// 			})[0];
		// 		}
		// 		else {
		// 			// Try to find a fallback
		// 			each( Object.keys( args ).sort(), function ( i, it ) {
		// 				if ( it.indexOf( 'fallback' ) === 0 ) {
		// 					var format = _guessMediaType( args[it] );
		// 
		// 				}
		// 			});
		// 		}
		// 
		// 		if ( source ) {
		// 			video.appendChild( source );
		// 			// fuzzbox.getVideoFallback();
		// 		}
		// 
		// 		contentArea.appendChild( video );
		// 	}
		// },

		'video/youtube': {
			insert: function ( item, contentArea, args ) {
				var iframe = fuzzbox.getIframe(),
					width = ( 'width' in args ) ? args.width : '100%',
					height = ( 'height' in args ) ? args.height : '100%';

				$( iframe ).attr({
					src   : 'http://www.youtube.com/embed/' + args.ytid,
					width : width,
					height: height
				});
				contentArea.appendChild( iframe );
			}
		}

	}

});

/* 
 * Overridable global settings 
 */

var settings = fuzzbox.settings = {};

extend( settings, {

	// Global UI text
	text: {
		close    : 'Close',
		next     : 'Next',
		previous : 'Previous'
	},

	// The delay before showing loading message
	preloadDelay: 80, 

	// The speed of overlay fade out on closing
	fadeSpeed:    120

});

/* jQuery plugin */

$.fn.fuzzbox = function ( options ) {

	var $els = this,
		options = options || {},
		html = 'html' in options,
		url = options.url,
		group = ( true === options.group ) && !( html || url ),
		items = [];

	if ( group ) {
		$els.each( function () {
			var o = {};
			o.url = this.href;
			o.element = this;
			items.push( o );
		});
	}

	$els.click( function () {
		var box = new $.fuzzbox,
			startIndex = 0,
			trigger = this,
			copyOptions = extend( {}, options );
		
		copyOptions.element = this;
		
		// Html argument or Url argument
		if ( html || url ) {
			// Do nothing
		}
		// Grouped links
		else if ( group ) {
			each( items, function ( index, it ) {
				if ( trigger === it.element ) {
					startIndex = index;
				}
			});
			copyOptions.index = startIndex;
		}
		// Direct items argument
		else if ( options.items ) {
			items = options.items; 
		}
		// Single links
		else {
			items = [{
				url: this.href,
				element: this
			}];
		}
		
		// Assign items if there are any
		if ( items.length ) {
			copyOptions.items = items;
		}
		
		// Return false on success, false otherwise
		return !box.open( copyOptions );
	
	});
	
	return $els;
};

})( jQuery ); // end outer closure
