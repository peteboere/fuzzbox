<?php

$delay = isset( $_GET[ 'delay' ] ) ? $_GET[ 'delay' ] : 0;

if ( $delay ) {
	sleep( $delay );
}

header( "Content-type: image/jpeg" );

$file = $_GET[ 'url' ];

echo file_get_contents( $file );

