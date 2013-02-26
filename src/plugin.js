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

    $els.click( function () {

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

