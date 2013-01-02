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
        self.options = options = extend( self.options, _options || {} );

        // Attach event handlers from options to the instance.
        $.each( options, function ( key, value ) {
            if ( /^on[A-Z]/.test( key ) ) {
                self[ key ] = value;
            }
        });

        // Call init (will only apply once).
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

            var ok = ( 'html' in it ) || it.url;
            if ( ! ok ) {
                return false;
            }

            // Get media type
            // --------------
            var el = it.element, // May not be set
                elemFuzzAttributes = getElemFuzzAttributes( el ),
                media;

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
            else if ( options.media ) {
                media = options.media;
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
            contentArea = fuzzdom.$content[0];

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

                // Clear the stage
                self.clearContentAreas();

                // Set the media class hook
                alterClass( fuzzdom.$fuzzbox, 'fzz-media-*',
                    getMediaClassNames( item.media ).join( ' ' ) );

                // Insert item content
                handler.insert( item, contentArea, item.mediaArgs || options.mediaArgs || {} );

                // Set caption area
                var caption = item.caption || self.options.caption,
                    element = item.element;
                if ( typeof caption === 'function' ) {
                    // May set to undefined if there is no return value
                    caption = caption.call( element || {}, item );
                }
                else {
                    caption = caption || ( element && element.title );
                }
                if ( caption ) {
                    fuzzdom.$caption.append( caption );
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

        // Avoid latency/display problems by reseting
        fuzzbox.resetImage();
        fuzzbox.resetIframe();

        // Reset vertically centering
        fuzzdom.$content.find( '.fzz-hero' ).css( 'margin-top', '' );

        if ( all ) {
            // Clear template area
            fuzzdom.$inner.empty();
            fuzzdom.$outer.css( 'top', '' );

            // Hard reset
            fuzzbox.resetImage( true );
        }
    }
};


