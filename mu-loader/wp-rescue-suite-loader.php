<?php
/**
 * MU loader for WP Rescue Suite.
 *
 * Copy this file into wp-content/mu-plugins/ to make sure RescueMode's
 * minimal endpoints are available even when normal plugins are down.
 */

if (!defined('ABSPATH')) {
	return;
}

$plugin_dir = WP_CONTENT_DIR . '/plugins/wp-rescuemode-ai/wp-rescuemode-ai.php';

// Check for Virtual Isolation Request (Scanner Loopback)
if (isset($_SERVER['HTTP_X_RESCUE_VIRTUAL_PLUGIN'])) {
	// We are in a "virtual" probe request.
	// Force WordPress to load ONLY the requested plugin (and us).
	add_filter('option_active_plugins', function () {
		$target = sanitize_text_field(wp_unslash($_SERVER['HTTP_X_RESCUE_VIRTUAL_PLUGIN']));
		$our_plugin = 'wp-rescuemode-ai/wp-rescuemode-ai.php';

		$plugins = [$target];
		if ($target !== $our_plugin) {
			$plugins[] = $our_plugin;
		}

		return $plugins;
	});
}

$request_uri = $_SERVER['REQUEST_URI'] ?? '';
$is_rescue_page = (!empty($request_uri) && preg_match('#/wp-rescue(/?$|\?)#', $request_uri));
$is_rescue_api = (!empty($request_uri) && strpos($request_uri, '/wp-rescuemode/v1/') !== false);
$is_rescue_request = $is_rescue_page || $is_rescue_api;

// if (defined('WP_CONTENT_DIR')) {
// }

// Emergency Shutdown Handler: Show Rescue Bubble on Fatal Errors
register_shutdown_function(function () {
	// DEBUG: Verify shutdown handler is called
	// file_put_contents(WP_CONTENT_DIR . '/shutdown-log.txt', date('c') . " Shutdown called. Error: " . print_r(error_get_last(), true) . "\n", FILE_APPEND);

	$error = error_get_last();
	// Check for fatal errors
	if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {

		// Handle API Errors with JSON
		if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/wp-rescuemode/v1/') !== false) {
			if (!headers_sent()) {
				header('Content-Type: application/json');
				http_response_code(500);
			}
			echo json_encode([
				'code' => 'fatal_error',
				'message' => $error['message'],
				'file' => $error['file'],
				'line' => $error['line']
			]);
			exit;
		}

		// Avoid showing bubble if we are already in rescue mode page
		if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/wp-rescue') !== false) {
			return;
		}

		if (function_exists('get_option') && function_exists('site_url')) {
			$token = get_option('wprai_rescue_token');
			if ($token) {
				// Ensure output is displayed even if Content-Length was sent
				if (!headers_sent()) {
					header_remove('Content-Length');
					header('Content-Type: text/html; charset=utf-8'); // Force HTML
				}

				// Try to clear any existing output buffers to prevent broken HTML
				while (ob_get_level()) {
					ob_end_flush();
				}

				$url = site_url('/wp-rescue?token=' . rawurlencode($token));
				echo sprintf(
					'<!-- WP Rescue Mode Injection -->
                    <div style="position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#fff;padding:20px;border-left:5px solid #d63638;box-shadow:0 5px 20px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">
						<h3 style="margin:0 0 10px;color:#d63638;font-size:18px;">Site Crashed?</h3>
						<p style="margin:0 0 15px;color:#333;font-size:14px;">Use Rescue Mode to diagnose and fix the issue.</p>
						<a href="%s" style="background:#d63638;color:white;text-decoration:none;padding:10px 15px;border-radius:4px;display:inline-block;font-weight:bold;font-size:14px;">Enter Rescue Mode &rarr;</a>
					</div>',
					esc_url($url)
				);
			}
		}
	}
});

if ($is_rescue_request) {
	// Disable all other plugins for this request so a crashing plugin doesn't block rescue.
	add_filter(
		'option_active_plugins',
		static function () {
			return ['wp-rescuemode-ai/wp-rescuemode-ai.php'];
		}
	);
	add_filter(
		'site_option_active_sitewide_plugins',
		static function () {
			return [];
		}
	);

	// Bypass theme/template and render a minimal rescue shell to avoid theme/plugin fatals.
	if ($is_rescue_page) {
		add_action(
			'template_redirect',
			static function () {
				$token = isset($_GET['token']) ? sanitize_text_field(wp_unslash($_GET['token'])) : '';
				$stored = get_option('wprai_rescue_token');

				if (empty($token) || !is_string($stored) || !hash_equals($stored, $token)) {
					status_header(401);
					wp_die(esc_html__('Invalid or missing rescue token.', 'wp-rescuemode-ai'));
				}

				$ver = defined('WPRAI_VERSION') ? WPRAI_VERSION : '0.1.2';
				$plugin_url = content_url('plugins/wp-rescuemode-ai');
				// $css_url = $plugin_url . '/assets/build/css/rescue.css?ver=' . $ver;
				$tailwind_url = $plugin_url . '/assets/build/css/tailwind.css?ver=' . $ver;
				$js_url = $plugin_url . '/assets/build/js/rescue.js?ver=' . $ver;

				nocache_headers();
				status_header(200);
				?>
			<!DOCTYPE html>
			<html <?php language_attributes(); ?>>

			<head>
				<meta charset="<?php bloginfo('charset'); ?>">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title><?php esc_html_e('WP RescueMode AI', 'wp-rescuemode-ai'); ?></title>
				<link rel="stylesheet" href="<?php echo esc_url($tailwind_url); ?>" />
				<!-- <link rel="stylesheet" href="<?php // echo esc_url($css_url); ?>" /> -->
			</head>

			<body class="wprai-rescue-body">
				<div id="wprai-rescue-root" class="wprai-rescue-shell"
					data-api-base="<?php echo esc_attr(rest_url('wp-rescuemode/v1/')); ?>"
					data-endpoint="<?php echo esc_attr(rest_url('wp-rescuemode/v1/diagnose')); ?>"
					data-email-endpoint="<?php echo esc_attr(rest_url('wp-rescuemode/v1/generate-email')); ?>"
					data-token="<?php echo esc_attr($token); ?>"
					data-rescue-url="<?php echo esc_attr(site_url('/wp-rescue?token=' . rawurlencode($token))); ?>">
				</div>
				<script type="module" src="<?php echo esc_url($js_url); ?>"></script>
			</body>

			</html>
			<?php
				exit;
			},
			-1000
		);
	}
}

if (file_exists($plugin_dir)) {
	include_once $plugin_dir;
}
