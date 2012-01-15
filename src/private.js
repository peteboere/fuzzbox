/* Private class variables and helper functions */

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

	// Detect for transition events
	// https://developer.mozilla.org/en/CSS/CSS_transitions
	transitionProperty = getVendorStyleProperty( 'transition' ),
	transitionEndEvents = {
		'transition'       : 'transitionend',
		'WebkitTransition' : 'webkitTransitionEnd',
		'MozTransition'    : 'transitionend',
		'OTransition'      : 'oTransitionEnd',
		'msTransition'     : 'MSTransitionEnd'
	},
	transitionEndEvent = transitionProperty && transitionEndEvents[ transitionProperty ],

	// MediaType:
	//    Flexible objects for storing major and minor media types as one
	MediaType = function ( media ) {
		// A mediaType object may be passed in, in this case return it
		if ( typeof media !== 'string' ) {
			return media;
		}
		var self = this,
			slash = media.indexOf( '/' );
		self[0] = media;
		self[1] = null;
		if ( slash !== -1 ) {
			self[0] = media.substring( 0, slash );
			self[1] = media.substring( slash+1 );
		}
		self.toString = function () {
			return self[0] + ( self[1] ? '/' + self[1] : '' );
		};
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
			mediaString = 'image/svg+xml';
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
		// 	pos = mediaType.indexOf( '/' );
		// if ( pos !== -1 ) {
		// 	// Generic media type identifier
		// 	classnames.push( 'fzz-media-' + mediaType.substring( 0, pos ) );
		// }
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
				});
			});
		}
		else {
			insertCallback();
		}
	},

	setNextPreviousBtns = function ( instance ) {

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

extend( fuzzbox, {
	MediaType:       MediaType,
	guessMediaType:  _guessMediaType,
	formats:         _formats,
	testVideoFormat: _testVideoFormat
});

