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
 *
 * fuzzbox.js
 *
 * Flexible media lightbox for jQuery
 *
 * Project page: https://github.com/peteboere/fuzzbox
 * License: http://www.opensource.org/licenses/mit-license.php
 * Copyright: (c) 2012 Pete Boere
 *
 */
(function ($) { // start outer closure

$output

})( jQuery ); // end outer closure

TPL;


$out_file = "$rootDir/jquery.fuzzbox.js";

file_put_contents( $out_file, $stream );

if ( isset( $yui_compress ) ) {
	$min_file = "$rootDir/jquery.fuzzbox.min.js";
	$yui_compressor = '/usr/local/Cellar/yuicompressor/2.4.6/libexec/yuicompressor-2.4.6.jar';
	system( "java -jar $yui_compressor '$out_file' > '$min_file'" );
}



