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
	fadeSpeed:    120,

});