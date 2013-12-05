<?php

error_reporting( -1 );

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

$now = @date( 'Y-m-d H:i:s O' );
$year = @date('Y');

$stream = <<<TPL
/*! @preserve

Flexible media lightbox for jQuery

Project: https://github.com/peteboere/fuzzbox
License: MIT
Copyright: (c) $year Pete Boere
Compiled: $now
*/
(function ($) { // start outer closure

$output

})( jQuery ); // end outer closure

TPL;


$out_file = "$rootDir/jquery.fuzzbox.js";

file_put_contents( $out_file, $stream );

if (getenv('FUZZBOX_COMPRESS')) {
    $compress = true;
}

if ( isset( $compress ) ) {

    $min_file = "$rootDir/jquery.fuzzbox.min.js";
    $command = <<<TPL
PATH="\$PATH:/usr/local/bin"
cat '$out_file' | uglifyjs -m -c --comments > '$min_file'
TPL;
    system( $command );
}
