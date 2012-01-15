<?php

error_reporting( -1 );

// $yui_compress = true;

$rootDir = dirname( __DIR__ );

$files = array(
	'helpers.js',
	'constructor.js',
	'prototype.js',
	'private.js',
	'static.js',
	'settings.js',
	'plugin.js',
);

$output = array();

foreach ( $files as $file ) {
	$output[] = trim( file_get_contents( "$rootDir/src/$file" ) );
}

$output = implode( "\n\n", $output );


$stream = <<<TPL
/*!
 * fuzzbox.js
 *
 * Versatile media lightbox for jQuery
 *
 */
(function ($) { // start outer closure
	
//try {

$output

//} catch (ex) { console.error( 'fuzzbox "' + ex + '"' ); }

})( jQuery ); // end outer closure

TPL;


$out_file = "$rootDir/fuzzbox.js";

file_put_contents( $out_file, $stream );

if ( isset( $yui_compress ) ) {
	$min_file = "$rootDir/fuzzbox.min.js";
	$yui_compressor = '/usr/local/Cellar/yuicompressor/2.4.6/libexec/yuicompressor-2.4.6.jar';
	system( "java -jar $yui_compressor '$out_file' > '$min_file'" );
}



