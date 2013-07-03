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
        $( [ DOM.$overlay[0], DOM.$outer[0] ] ).click( function ( e ) {
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

