<?php
/**
 * Plugin Name: WP RescueMode AI
 * Description: AI-powered rescue mode and conflict scanner for WordPress. Provides protected rescue UI and admin scanner.
 * Version: 0.1.0
 * Author: WP Rescue Suite
 * License: GPL-3.0+
 * Text Domain: wp-rescuemode-ai
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WPRAI_PLUGIN_FILE', __FILE__ );
define( 'WPRAI_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WPRAI_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'WPRAI_VERSION', '0.1.0' );

require_once WPRAI_PLUGIN_DIR . 'inc/helpers.php';

// Simple PSR-4ish loader for this plugin's classes.
spl_autoload_register(
	static function ( $class ) {
		if ( 0 !== strpos( $class, 'WPRAI\\' ) ) {
			return;
		}

		$path = WPRAI_PLUGIN_DIR . 'inc/' . strtolower( str_replace( [ 'WPRAI\\', '_' ], [ '', '-' ], $class ) ) . '.php';

		if ( file_exists( $path ) ) {
			require_once $path;
		}
	}
);

register_activation_hook(
	__FILE__,
	static function () {
		$plugin = WPRAI\Plugin::instance();
		$plugin->on_activation();
	}
);

register_deactivation_hook(
	__FILE__,
	static function () {
		$plugin = WPRAI\Plugin::instance();
		$plugin->on_deactivation();
	}
);

add_action(
	'plugins_loaded',
	static function () {
		WPRAI\Plugin::instance()->boot();
	}
);
