/*!

Flexible media lightbox for jQuery

Project: https://github.com/peteboere/fuzzbox
License: http://www.opensource.org/licenses/mit-license.php (MIT)
Copyright: (c) 2012 Pete Boere
Compiled: 2013-11-29 16:17:33 +0000

*/
(function ($) { // start outer closure

/*
 * Generic shortcuts and helper functions
 */

var win = window;
var doc = document;
var $window = $(win);
var $document = $(doc);
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

/*
 * Constructor
 */

var fuzzbox = $.fuzzbox = function ( options ) {

    this.options = extend({

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
        closeOnPressEscape: true,

        // Viewport width at which shrink-to-fit behaviour is disabled.
        fittingBreakpoint: 0,

        // Fixed viewport mode.
        fixedViewport: false,

        // The ARIA role that applies to the box.
        role: 'dialog'

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

        // Extend options.
        self.options = OPTIONS = extend( self.options, _options || {} );

        // Attach event handlers from options to the instance.
        $.each( OPTIONS, function ( key, value ) {
            if ( /^on[A-Z]/.test( key ) ) {
                self[ key ] = value;
            }
        });

        // Call init (will only apply once).
        fuzzbox.init();

        // Set template
        self.$template = fuzzbox.template[ OPTIONS.template || 'basic' ];

        // Append content to the inner wrapper.
        var $inner = DOM.$inner;
        $inner.append( self.$template );

        // Get standard placeholders.
        DOM.$content = $inner.find( '#fzz-content' );
        DOM.$caption = $inner.find( '#fzz-caption' );
        DOM.$previous = $inner.find( '#fzz-previous' );
        DOM.$next = $inner.find( '#fzz-next' );

        // Set UI elements.
        DOM.$closeBtn.find( '>span' ).html( OPTIONS.text.close );
        DOM.$previous.find( '>span' ).html( OPTIONS.text.previous );
        DOM.$next.find( '>span' ).html( OPTIONS.text.next );

        // Set active instance.
        INSTANCE = fuzzbox.instance = this;

        // Resolve items.
        self.items = self.prepareItems( OPTIONS.items || [] );
        if ( ! self.items ) {
            return false;
        }

        // Set dimensions for first displayed item, set class hooks etc.
        self.prepareStage( true );

        // Make visible.
        fuzzbox._open();

        // Set state variables.
        FIRST_ITEM = true;
        SCROLL_TOP = $window.scrollTop();

        // Fixed viewport.
        if (OPTIONS.fixedViewport) {
            var $root = $('html');
            var $body = $(document.body);

            $document.one('fzz_open', function () {

                // Get scrollbar width.
                var originalWindowWidth = $window.width();
                $root.addClass('fzz-fixed');

                var scrollbar = (originalWindowWidth - $window.width());
                if (scrollbar) {
                    $body.css('border-right', 'solid ' + Math.abs(scrollbar) + 'px #eee');
                }

                var scrollToTop = function () {
                    DOM.$viewport.scrollTop(0);
                };
                scrollToTop()
            })
            $document.one('fzz_close', function () {
                $root.removeClass('fzz-fixed');
                $body.css('border-right', '');
            });
        }

        // Load the first item, remove startup styling hook when done.
        self.loadItem( ITEM, function () {
            defer( function () {
                FIRST_ITEM = false;

                // Store a reference to the current focussed element on the page.
                self.trigger = doc.activeElement;

                // Pick out an element to focus on.
                var $focusElement = DOM.$content.find('[autofocus]');
                if (! $focusElement.length) {
                    $focusElement = DOM.$wrapper;
                }
                defer(function () {
                    $focusElement.last().focus();
                });

                // Automatically set ARIA labelledby if an element with id `fzz-title` is found.
                fuzzbox.setAriaLabel('fzz-title', DOM.$content);

                alterClass(DOM.$fuzzbox, 'fzz-startup', 'fzz-open');
                fuzzbox.position();
                raiseEvent('open');
            }, 50 );
        });

        // Return true to the event handler.
        return true;
    },

    prepareItems: function ( items ) {

        var self = this;
        var hasHtmlOption = 'html' in OPTIONS;

        // Invocations with 'html' or 'url' arguments have priority over groups of items
        // 'html' argument has priority over 'url'
        if ( hasHtmlOption || OPTIONS.url ) {
            var it = {
                caption: OPTIONS.caption,
                mediaArgs: OPTIONS.mediaArgs,
                element: OPTIONS.element,
                width: OPTIONS.width,
                height: OPTIONS.height
            };
            if ( hasHtmlOption ) {
                it.html = OPTIONS.html;
            }
            else {
                it.url = OPTIONS.url;

                // Additional ajax information if supplied.
                it.data = OPTIONS.data;
                it.postData = OPTIONS.postData;
            }
            items = [it];
        }

        // Filter out items that have no content, empty urls or an indetermined media type
        items = $.grep( items, function ( it, index ) {

            var ok = ( 'html' in it ) || it.url;
            if ( ! ok ) {
                return false;
            }

            // Get media type
            // --------------
            var el = it.element; // May not be set
            var elemFuzzAttributes = getElemFuzzAttributes( el );
            var media;

            // html override.
            if ( 'html' in it ) {
                media = 'html';
            }
            // Test for explicitly set option.
            else if ( it.media ) {
                media = it.media;
            }
            // Test for an element attribute.
            else if ( elemFuzzAttributes && elemFuzzAttributes.media ) {
                media = elemFuzzAttributes.media;
            }
            // Use a globally set option.
            else if ( OPTIONS.media ) {
                media = OPTIONS.media;
            }
            // Try to guess media type, fallback to `html`.
            else {
                if ( !( media = _guessMediaType( it.url ) ) ) {
                    media = 'html';
                }
            }

            // Assign mediaType object.
            it.media = new Media( media );

            // Store attributes.
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

        // Decorate items
        each( items, function ( index, it ) {
            it.index = index;
            it.group = items;
        });

        // Exit if there's nothing to show
        var itemCount = items.length;
        var singleItem = itemCount === 1;
        if ( ! itemCount ) {
            log( 'No items to display' );
            return false;
        }

        return items;
    },

    prepareStage: function ( startup ) {

        var self = this;

        // Get start index
        self.index = OPTIONS.index || 0;
        var itemCount = self.items.length;
        if ( self.index > itemCount-1 ) {
            // If specified index is out of range select last index
            self.index = itemCount-1;
        }

        // Set activeItem
        ITEM = self.items[ self.index ];

        // Set styling hooks
        var singleItem = itemCount === 1;
        var theme = ( singleItem && ITEM.attr.theme ) || OPTIONS.theme || 'default';
        var classnames = [
                'fzz-itemcount-' + self.items.length,
                'fzz-theme-' + $.trim( theme ).split( ' ' ).join( ' fzz-theme-' )
            ];

        // Add startup hook if launching.
        if (startup) {
            classnames.push('fzz-startup');
        }
        DOM.$fuzzbox.attr('class', classnames.join(' '));

        // Set ARIA role.
        DOM.$fuzzbox.attr('role', OPTIONS.role);

        // Set wrapper dimensions
        var width = 'width' in OPTIONS ? OPTIONS.width : '';
        var height = 'height' in OPTIONS ? OPTIONS.height : '';
        var widthAttr = ITEM.attr.width;
        var heightAttr = ITEM.attr.height;
        var unitTestPatt = /[^0-9\.]/;

        // If a dimension is not set in options and is a single item, look in item attributes
        if ( ! width && singleItem && widthAttr ) {
            width = unitTestPatt.test( widthAttr ) ? widthAttr : +widthAttr;
        }
        if ( ! height && singleItem && ITEM.attr.height ) {
            height = unitTestPatt.test( heightAttr ) ? heightAttr : +heightAttr;
        }
        // Save computed dims
        self.dims = { width: width, height: height };
        fuzzbox.setDims();

        // Set the state of pagination buttons
        self.setNextPreviousBtns();
    },

    setNextPreviousBtns: function () {

        var self = this;
        var itemCount = self.items.length;
        var $previous = DOM.$previous;
        var $next = DOM.$next;

        if ( itemCount < 2 ) {
            self.disableLink( $previous );
            self.disableLink( $next );
        }
        else if ( ! OPTIONS.cycle ) {
            self[ ( self.index > 0 ? 'enable' : 'disable' ) + 'Link' ]( $previous );
            self[ ( self.index < itemCount-1 ? 'enable' : 'disable' ) + 'Link' ]( $next );
        }
    },

    loadItem: function ( item, callback ) {

        var self = this;
        var contentArea = DOM.$content[0];

        // Set activeItem and previousItem.
        self.previousItem = PREV_ITEM = self.activeItem;
        self.activeItem = ITEM = item;

        // Prepare loading message.
        self.prepareLoadMsg();

        // Choose handler.
        var mediaHandler = null;

        if ( 'errorMsg' in item ) {
            mediaHandler = 'error';
        }
        else {

            var fullMediaType = item.media.toString();
            var majorMediaType = item.media[0];

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

                // Clear the stage.
                self.clearContentAreas();

                // Set the media class hook.
                alterClass( DOM.$fuzzbox, 'fzz-media-*',
                    getMediaClassNames( item.media ).join( ' ' ) );

                raiseEvent('beforeInsert', {item: item});

                // Insert item content.
                var mediaArgs = item.mediaArgs || OPTIONS.mediaArgs || {};
                handler.insert(item, contentArea, mediaArgs);

                // Set caption area.
                var caption = item.caption || OPTIONS.caption;
                var element = item.element;
                if ( typeof caption === 'function' ) {
                    // May set to undefined if there is no return value.
                    caption = caption.call( element || {}, item );
                }
                else {
                    caption = caption || ( element && element.title );
                }
                if ( caption ) {
                    DOM.$caption.append( caption );
                }

                raiseEvent('insert');

                // Invoke any additional callback passed in.
                callback && callback();

                // Position the hero.
                fuzzbox.positionHero( item );

                // Position the container.
                fuzzbox.position();
            };

        // If no loading required just display
        if ( ! handler.load ) {

            self.cancelLoadMsg();
            displayItem( function () {
                insert( item, mediaHandler );
            });
            raiseEvent( 'load' );
        }
        // Load item then display
        else {

            handler.load( item, function () {
                self.cancelLoadMsg();
                if ( item.errorMsg ) {
                    mediaHandler = 'error'
                    handler = fuzzbox.media[ mediaHandler ];
                    item.media.update( mediaHandler );
                }
                displayItem( function () {
                    insert( item, mediaHandler );
                });
                raiseEvent( 'load' );
            });
        }

    },

    reload: function ( items ) {
        var self = this;
        self.items = self.prepareItems( items );
        self.prepareStage();
        self.loadItem( self.items[0] );
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
        UI_LOCKED = true;
        DOM.$loading.show();
        DOM.$fuzzbox.addClass( 'fzz-loading' );
        raiseEvent( 'showLoadMsg' );
    },

    hideLoadMsg: function () {
        UI_LOCKED = false;
        DOM.$loading.hide();
        DOM.$fuzzbox.removeClass( 'fzz-loading' );
        raiseEvent( 'hideLoadMsg' );
    },

    disableLink: function ( $el ) {
        var href = $el.attr( 'href' );
        $el.addClass( 'disabled' )
            .removeAttr( 'href' )
            .attr( 'data-href', href );
    },

    enableLink: function ( $el ) {
        var href = $el.attr( 'data-href' ) || $el[0].href;
        $el.removeClass( 'disabled' )
            .attr( 'href', href );
    },

    // 'previous', 'next' or a goto integer (not zero index)
    goTo: function ( dest ) {

        var self = this;
        var items = self.items;
        var lastIndex = items.length-1;
        var currentIndex = self.index;

        if ( UI_LOCKED || items.length < 2 ) {
            return;
        }

        var newIndex;

        // Previous keyword
        if ( 'previous' == dest ) {
            newIndex = ( currentIndex > 0 ) ? currentIndex - 1 : 0;
            if ( OPTIONS.cycle ) {
                newIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
            }
        }
        // Next keyword
        else if ( 'next' == dest ) {
            newIndex = ( currentIndex < lastIndex ) ? currentIndex + 1 : lastIndex;
            if ( OPTIONS.cycle ) {
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

        self.setNextPreviousBtns();

        self.loadItem( items[ self.index ] );
    },

    next: function () {
        var self = this;
        if ( ! OPTIONS.cycle && self.index >= self.items.length-1  ) {
            return;
        }
        this.goTo( 'next' );
    },

    previous: function () {
        var self = this;
        if ( ! OPTIONS.cycle && self.index <= 0 ) {
            return;
        }
        self.goTo( 'previous' );
    },

    close: function () {

        var self = this;

        // Hide the fuzzbox.
        fuzzbox._close(function () {

            $(window).scrollTop(SCROLL_TOP);

            // Hand focus back to the page.
            if (ITEM.element) {
                ITEM.element.focus()
            }
            else {
                self.trigger && self.trigger.focus();
            }

            raiseEvent('close');

            self.cleanup();
        });
    },

    cleanup: function () {

        var self = this;
        self.clearContentAreas( true );
        self.enableLink( DOM.$previous );
        self.enableLink( DOM.$next );
        self.cancelLoadMsg();

        DOM.$fuzzbox.removeClass( 'fzz-open' );

        // Reset wrapper styles; may have been set by dragging
        var style = DOM.$wrapper[0].style;
        style.top =
        style.left = '';
        fuzzbox.instance = INSTANCE = null;
    },

    clearContentAreas: function ( all ) {

        // If showing consecutive (loaded) images we'll call it a slideshow
        var slideshow =
                PREV_ITEM &&
                ! PREV_ITEM.errorMsg &&
                'image' === PREV_ITEM.media[0] &&
                'image' === ITEM.media[0];

        if ( ! slideshow ) {
            DOM.$content.empty();
        }

        DOM.$caption.empty();

        // Avoid latency/display problems by reseting
        fuzzbox.resetImage();
        fuzzbox.resetIframe();

        // Reset vertically centering
        DOM.$content.find( '.fzz-hero' ).css( 'margin-top', '' );

        if ( all ) {
            // Clear template area
            DOM.$inner.empty();
            DOM.$outer.css( 'top', '' );

            // Hard reset
            fuzzbox.resetImage( true );
        }
    }
};

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

/*
 * Static methods and properties
 */

extend( fuzzbox, {

    // Debug mode for logging messages to the console.
    DEBUG: false,

    // Status.
    opened: false,

    // Reference to active fuzzbox instance (if any).
    instance: null,

    // Inititalization:
    //     Called once on first launch, subsequent calls will bounce.
    init: function () {

        if (fuzzbox.initialized) {
            return;
        }

        // Create base html
        var $html = $(
            '<div id="fuzzbox" role="dialog">' +
                '<div id="fzz-overlay"></div>' +
                '<div id="fzz-viewport">' +
                    '<div id="fzz-outer">' +
                        '<div id="fzz-wrapper" tabindex="0">' +
                            '<a id="fzz-close" href="modal:close"><span></span></a>' +
                            '<div id="fzz-inner"></div>' +
                            '<div id="fzz-loading"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' );

        // Get dom references
        DOM.$fuzzbox  = $html,
        DOM.$overlay  = $('#fzz-overlay', $html);
        DOM.$viewport = $('#fzz-viewport', $html);
        DOM.$loading  = $('#fzz-loading', $html);
        DOM.$outer    = $('#fzz-outer', $html);
        DOM.$wrapper  = $('#fzz-wrapper', $html);
        DOM.$inner    = $('#fzz-inner', $html);
        DOM.$closeBtn = $('#fzz-close', $html);

        // Hide the loading screen
        DOM.$loading.hide();

        // Shortcuts
        var $wrapper = DOM.$wrapper;

        // Delegate events
        $wrapper.click( function ( e ) {

            var $target = $( e.target ).closest( 'a' );
            var target = $target[0];
            var command = null;

            // Check for pseudo protocol commands:
            //     next, previous, cancel, goto(n), n
            var pseudo = 'modal:';
            var commandArg;

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
        var dragInfo;
        var startDrag = function ( e, $el ) {
            var pageX = e.pageX;
            var pageY = e.pageY;
            var elWidth = $el.width();
            var offset = $el.offset();
            var left = offset.left;
            var top = offset.top;
            var startX = parseInt( $el.css( 'left' ), 10 ) || 0;
            var startY = parseInt( $el.css( 'top' ), 10 ) || 0;
            var handleOffsetX = pageX - left;
            var handleOffsetY = pageY - top;
            var viewPortWidth = $window.width();

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
            $document.mousemove( onDragMove );
        };
        var onDragMove = function ( e ) {
            var pageX = e.pageX;
            var pageY = e.pageY;
            var mouse = dragInfo.m;
            var el = dragInfo.el;
            var wrapper = $wrapper[0];
            var style = wrapper.style;
            var left;
            var top;

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

        $wrapper.on('mousedown.fuzzbox', function (e) {

            var $target = $( e.target );
            if ( $target.hasClass( 'fzz-handle' ) ) {
                startDrag( e, $wrapper );
                $document.one( 'mouseup blur', function () {
                    $document.unbind( 'mousemove', onDragMove );
                });
                return false;
            }
        });

        // Optionally close by clicking outside the content
        $( [ DOM.$overlay[0], DOM.$outer[0], DOM.$viewport[0] ] ).click( function ( e ) {
            if ( e.target === this && OPTIONS.closeOnClickOutside ) {
                fuzzbox.close();
            }
        });

        // Close with escape key.
        $document.on('keyup.fuzzbox', function (e) {
            var keycode = e.keyCode || e.which;
            if ( keycode === 27 && fuzzbox.opened && OPTIONS.closeOnPressEscape ) {
                fuzzbox.close();
            }
        });

        // Keyboard pagination.
        $document.on('keydown.fuzzbox', function (e) {
            var keycode = e.keyCode || e.which;
            if ( fuzzbox.opened ) {
                if ( 37 === keycode ) {
                    // left
                    fuzzbox.previous();
                }
                else if ( 39 === keycode ) {
                    // right
                    fuzzbox.next();
                }
            }
        });

        // Handle window resize events.
        $window.on('resize.fuzzbox', function (e) {
            if (! INSTANCE) {
                return;
            }
            fuzzbox.position();
            fuzzbox.positionHero();
            fuzzbox.setHeight();
        });

        // Hide initially.
        DOM.$fuzzbox.hide();

        // Append to the dom.
        $('body').append(DOM.$fuzzbox);

        raiseEvent('init');

        // Flag as done.
        fuzzbox.initialized = true;
    },

    // Internal open method
    _open: function () {

        DOM.$fuzzbox.show();
        fuzzbox.position(true);
        fuzzbox.opened = true;
    },

    // Internal close method
    _close: function ( callback ) {

        var $fuzzbox = DOM.$fuzzbox;

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
        INSTANCE && INSTANCE.close();
    },

    // Active instance previous
    previous: function () {
        INSTANCE && INSTANCE.previous();
    },

    // Active instance next
    next: function () {
        INSTANCE && INSTANCE.next();
    },

    // Active instance goTo
    goTo: function ( dest ) {
        INSTANCE && INSTANCE.goTo( dest );
    },

    position: function (initialCentering) {

        var outer = DOM.$outer[0];
        var outerHeight = outer.offsetHeight;
        var viewportHeight = $window.height();
        var scrollTop = $window.scrollTop();
        var top = 0;
        var vAlign = OPTIONS.vAlign;

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

        if (initialCentering || ! OPTIONS.fixedViewport) {
            top += scrollTop;
        }
        outer.style.top = top + 'px';
    },

    positionHero: function ( item ) {

        // If hero object is in the content area we'll center it vertically
        var $hero = DOM.$content.find( '.fzz-hero' );

        // Do not attempt vertical centering if OPTIONS.exactFit
        if ( ! OPTIONS.exactFit && $hero.length ) {

            var hero = $hero[0],
                contentHeight = DOM.$content[0].offsetHeight,
                heroHeight = hero.offsetHeight;

            // Inserted images suffer latency
            if ( item && item.image ) {
                heroHeight = item.image.height;
            }

            diff = contentHeight - heroHeight;
            if ( diff > 0 ) {
                hero.style.marginTop = ( diff / 2 ) + 'px';
            }
        }
    },

    setAriaLabel: function (elementId, context) {

        var $label = elementId && $('#' + elementId, context || document);
        if ($label && $label.length) {
            DOM.$fuzzbox.attr('aria-labelledby', elementId);
        }
        else {
            DOM.$fuzzbox.removeAttr('aria-labelledby');
        }
    },

    setAriaDescription: function (elementId, context) {

        var $label = elementId && $('#' + elementId, context || document);
        if ($label && $label.length) {
            DOM.$fuzzbox.attr('aria-describedby', elementId);
        }
        else {
            DOM.$fuzzbox.removeAttr('aria-describedby');
        }
    },

    loadUrl: function ( url, item, callback ) {

        // HTML resources
        var options = {
            url: url,
            success: function ( data ) {
                item.html = data;
                callback( item );
            },
            error: function ( jqxhr, status ) {
                item.errorMsg = status;
                item.xhr = jqxhr;
                callback( item );
            }
        };

        if (item.data) {
            options.data = item.data;
        }
        if (item.postData) {
            options.data = item.postData;
            options.type = 'POST';
        }
        $.ajax(options);
    },

    loadImage: function ( url, item, callback ) {

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

        var iframe = DOM.iframe;
        if ( ! iframe ) {
            iframe = DOM.iframe = createElement( 'iframe' );
        }
        $( iframe ).attr({
            'class' : 'fzz-hero',
            'frameborder': 0,
            'width':  '100%',
            'height': '100%'
        });
        return iframe;
    },


    resetIframe: function () {
        var iframe = DOM.iframe;
        if ( iframe ) {
            iframe.src = 'data:text/html,0';
        }
    },


    getVideo: function () {
        var video = DOM.video;
        if ( ! video ) {
            video = DOM.video = createElement( 'video' );
            video.className = 'fzz-hero';
        }
        return video;
    },

    getAudio: function () {
        var audio = DOM.audio;
        if ( ! audio ) {
            audio = DOM.audio = createElement( 'audio' );
            audio.className = 'fzz-hero';
        }
        return audio;
    },

    getImage: function () {
        var image = DOM.image;
        if ( ! image ) {
            image = DOM.image = createElement( 'img' );
            image.className = 'fzz-hero';
        }
        return image;
    },

    resetImage: function ( hardReset ) {

        var image = DOM.image;
        if ( image ) {
            if ( hardReset ) {
                delete DOM.image;
                DOM.image = fuzzbox.getImage();
            }
            else {
                image.style.marginTop = '';
            }
        }
    },

    setDims: function () {
        fuzzbox.setWidth();
        fuzzbox.setHeight();
    },

    setWidth: function ( width ) {
        var widthMap = {
            'max-width': INSTANCE.dims.width || width || ''
        };

        if ( widthMap[ 'max-width' ] ) {

            // Adjust width to compensate for margin and padding on the inner container
            //
            // * Bail if the width set is not a plain integer or using px units
            // * Units other than pixels not supported at the moment

            if ( /\d+(px)?$/.test( widthMap[ 'max-width' ]+'' ) ) {

                // Measure the horizontal padding, margin and border on the inner container
                var $inner = DOM.$inner;
                var horizontalPaddingAndMargin = $inner.outerWidth( true ) - $inner.width();

                // Add the computed horizontal margin + padding
                widthMap[ 'max-width' ] =
                    parseInt( widthMap[ 'max-width' ], 10 ) +
                    horizontalPaddingAndMargin
            }
        }

        DOM.$wrapper.css( widthMap );
    },

    setHeight: function ( height ) {
        var heightMap = {
            'height': INSTANCE.dims.height || height || ''
        };
        DOM.$content.css( heightMap );
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
                $( contentArea ).append( item.html );
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
                image.src = item.image.src;

                var imgWidth = image.naturalWidth || item.image.width;
                var imgHeight = image.naturalHeight || item.image.height;

                // Set the height if the content is smaller than the window viewport.
                // The main image won't always be rendered on time.
                var winWidth = $window.width();
                var breakpoint = OPTIONS.fittingBreakpoint;
                var applyBreakpoint = breakpoint && ( winWidth < breakpoint );

                if ( winWidth > imgWidth || applyBreakpoint ) {

                    fuzzbox.setHeight( imgHeight );

                    // Shrink wrap to image dimensions (using max-width).
                    if ( OPTIONS.exactFit ) {
                        fuzzbox.setWidth( imgWidth );
                    }
                }

                // Append.
                if ( ! image.parentNode ) {
                    contentArea.appendChild( image );
                }
            }
        },

        iframe: {

            insert: function ( item, contentArea, args ) {

                var iframe = fuzzbox.getIframe();
                var width = ( 'width' in args ) ? args.width : '100%';
                var height = ( 'height' in args ) ? args.height : '100%';
                var opts = {
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
        //  insert: function ( item, contentArea, args ) {
        //      var video = fuzzbox.getVideo(),
        //          attrs = {
        //              width :   'width' in args ? args.width : '100%',
        //              height:   'height' in args ? args.height : '100%',
        //              poster:   args.poster || null,
        //              // Boolean attributes
        //              autoplay: 'autoplay' in args ? true : null,
        //              controls: 'controls' in args ? true : null,
        //              loop:     'loop' in args ? true : null,
        //              muted:    'muted' in args ? true : null
        //          },
        //          $video = $( video );
        //      $video.attr( attrs );
        //
        //      var videoType = item.media[1],
        //          formats = fuzzbox.formats.video,
        //          format = videoType && formats[videoType],
        //          source;
        //
        //      if ( _testVideoFormat( format ) ) {
        //          source = $( '<source/>' ).attr({
        //              type: format,
        //              src:  item.url
        //          })[0];
        //      }
        //      else {
        //          // Try to find a fallback
        //          each( Object.keys( args ).sort(), function ( i, it ) {
        //              if ( it.indexOf( 'fallback' ) === 0 ) {
        //                  var format = _guessMediaType( args[it] );
        //
        //              }
        //          });
        //      }
        //
        //      if ( source ) {
        //          video.appendChild( source );
        //          // fuzzbox.getVideoFallback();
        //      }
        //
        //      contentArea.appendChild( video );
        //  }
        // },

        'video/youtube': {

            insert: function ( item, contentArea, args ) {

                var iframe = fuzzbox.getIframe();
                var width = ( 'width' in args ) ? args.width : '100%';
                var height = ( 'height' in args ) ? args.height : '100%';

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
    fadeSpeed:    150

});

/* jQuery plugin */

$.fn.fuzzbox = function ( options ) {

    var $els = this;
    var options = options || {};
    var html = 'html' in options;
    var url = options.url;
    var group = ( true === options.group ) && !( html || url );
    var items = [];

    if ( group ) {
        $els.each( function () {
            var o = {};
            o.url = this.href;
            o.element = this;
            items.push( o );
        });
    }

    $els.click( function (e) {

        var box = new $.fuzzbox;
        var startIndex = 0;
        var trigger = this;
        var copyOptions = extend( {}, options );

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
                // Avoid empty links
                url: this.getAttribute( 'href' ) ? this.href : null,
                element: this
            }];
        }

        // Assign items if there are any
        if ( items.length ) {
            copyOptions.items = items;
        }

        // Return false on success, false otherwise
        return ! box.open( copyOptions );

    });

    return $els;
};

})( jQuery ); // end outer closure
