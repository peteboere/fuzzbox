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

        raiseEvent( 'open' );

        // Capture the page focussed element then hand focus over to fuzzbox.
        self.trigger = doc.activeElement;
        DOM.$wrapper.focus();

        // Set first item flag true.
        FIRST_ITEM = true;

        // Load the first item, remove startup styling hook when done.
        self.loadItem( ITEM, function () {
            defer( function () {
                alterClass( DOM.$fuzzbox, 'fzz-startup', 'fzz-open' );
                FIRST_ITEM = false;
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
        if ( startup ) {
            classnames.push( 'fzz-startup' );
        }
        DOM.$fuzzbox.attr( 'class', classnames.join( ' ' ) );

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

                // Clear the stage
                self.clearContentAreas();

                // Set the media class hook
                alterClass( DOM.$fuzzbox, 'fzz-media-*',
                    getMediaClassNames( item.media ).join( ' ' ) );

                // Insert item content
                handler.insert( item, contentArea, item.mediaArgs || OPTIONS.mediaArgs || {} );

                // Set caption area
                var caption = item.caption || OPTIONS.caption;
                var element = item.element;
                if ( typeof caption === 'function' ) {
                    // May set to undefined if there is no return value
                    caption = caption.call( element || {}, item );
                }
                else {
                    caption = caption || ( element && element.title );
                }
                if ( caption ) {
                    DOM.$caption.append( caption );
                }

                // Fire insert event
                raiseEvent( 'insert' );

                // Invoke any additional callback passed in
                callback && callback();

                // Position the hero
                fuzzbox.positionHero( item );

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

        // Hide the fuzzbox
        fuzzbox._close( function () {

            raiseEvent( 'close' );

            // Hand focus back to the page
            if ( ITEM.element ) {
                ITEM.element.focus()
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


