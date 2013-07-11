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

