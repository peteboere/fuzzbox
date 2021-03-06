/*
 * Private class variables and helper functions.
 */

// Shortcut ref to active instance.
var INSTANCE;

// Shortcut ref to active item.
var ITEM;

// Shortcut ref to previous item.
var PREV_ITEM;

// Flag. Set for first item on launch.
var FIRST_ITEM;

// Shortcut ref to active instance options.
var OPTIONS;

// Window position.
var SCROLL_TOP;

// Flag. Lock UI paging controls during transitions.
var UI_LOCKED;

// Cache for dom references.
var DOM = fuzzbox.dom = {};

// MediaType:
//    Flexible objects for storing major and minor media types as one
var Media = function ( media ) {

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
};

// Guess a media type from url file extention
var _guessMediaType = function ( url ) {

    var filename = url.toLowerCase();
    var pos = filename.indexOf( '#' );
    var mediaString = null;

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
};

// Parse dom element for fuzz attributes
var getElemFuzzAttributes = function ( element ) {

    if ( ! element ) {
        return null;
    }
    var out = {};
    var prefix = 'data-fzz-';

    // Get all prefixed attributes
    // Then filter into a hash
    each( element.attributes, function ( index, attr ) {
        var name = attr.name;
        var pos = name.indexOf( prefix );
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
};

// Create fuzzbox media classnames
var getMediaClassNames = function ( mediaType ) {

    var classnames = [];
    classnames.push( 'fzz-media-' + mediaType[0] );
    classnames.push( 'fzz-media-' + ( mediaType+'' ).replace( /\//, '-' ) );
    return classnames;
};

var raiseEvent = function (eventType, eventObject) {

    var eventTypeCap = 'on' + capitalize(eventType);
    var eventObject = eventObject || {};
    eventObject.type = eventType;

    $document.trigger('fzz_' + eventType, eventObject);

    if (INSTANCE && INSTANCE[eventTypeCap]) {
        INSTANCE[eventTypeCap].call(INSTANCE, eventObject);
    }
};

// Fade down old item, invoke insertCallback, fadeUp
var displayItem = function ( insertCallback ) {

    var option = 'transitionFadeSpeed';
    var transitionFadeSpeed = option in OPTIONS ? OPTIONS[ option ] : 0;
    var $content = DOM.$content;

    if ( transitionFadeSpeed && ! FIRST_ITEM ) {
        UI_LOCKED = true;
        fadeTo( $content, 0, transitionFadeSpeed, function () {
            insertCallback();
            defer( function () {
                fadeTo( $content, 1, transitionFadeSpeed, function () {
                    UI_LOCKED = false;
                });
            }, 13 );
        });
    }
    else {
        insertCallback();
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
};
var _formats = {
    video: {
        mp4:  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        webm: 'video/webm; codecs="vp8, vorbis"',
        ogg:  'video/ogg; codecs="theora, vorbis"'
    },
    audio: {}
};

// Add utilities to the namespace.
extend( fuzzbox, {
    Media:           Media,
    guessMediaType:  _guessMediaType,
    formats:         _formats,
    testVideoFormat: _testVideoFormat
});

