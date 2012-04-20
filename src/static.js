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

