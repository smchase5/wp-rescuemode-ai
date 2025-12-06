<?php
// Standalone rescue entry that bypasses theme/plugins and renders the rescue UI.

$token = isset($_GET['token']) ? $_GET['token'] : '';

// Pretend this request is /wp-rescue so the MU loader disables other plugins.
$_SERVER['REQUEST_URI'] = '/wp-rescue' . ($token ? '?token=' . rawurlencode($token) : '');

// Define paths relative to this file
$plugin_dir = __DIR__;
$wp_content_dir = dirname(dirname($plugin_dir));
$mu_dir = $wp_content_dir . '/mu-plugins';
$loader_src = $plugin_dir . '/mu-loader/wp-rescue-suite-loader.php';
$loader_dest = $mu_dir . '/wp-rescue-suite-loader.php';

// Auto-install MU loader if missing (Before loading WP to ensure protection)
if (file_exists($loader_src) && !file_exists($loader_dest)) {
	if (!is_dir($mu_dir)) {
		mkdir($mu_dir, 0755, true);
	}
	copy($loader_src, $loader_dest);
}

// Load WordPress (mu-plugins will run and strip other plugins).
$wp_load = dirname($plugin_dir, 2) . '/wp-load.php';
if (!file_exists($wp_load)) {
	// Try one level up (if wp-content is custom)
	$wp_load = dirname($plugin_dir, 3) . '/wp-load.php';
}

if (!file_exists($wp_load)) {
	http_response_code(500);
	echo 'Cannot locate wp-load.php';
	exit;
}

require_once $wp_load;

// If the plugin is active, the normal template_redirect in Plugin::maybe_render_rescue_page will render.
// Otherwise, render a minimal fallback.
if (function_exists('rest_url')) {
	// Trigger the plugin render if not already rendered.
	if (class_exists('WPRAI\Plugin')) {
		WPRAI\Plugin::instance()->maybe_render_rescue_page();
	}
}

// Fallback minimal output.
$stored = get_option('wprai_rescue_token');
if (empty($token) || !is_string($stored) || !hash_equals($stored, $token)) {
	status_header(401);
	wp_die(esc_html__('Invalid or missing rescue token.', 'wp-rescuemode-ai'));
}

$ver = defined('WPRAI_VERSION') ? WPRAI_VERSION : '0.1.2';
$plugin_url = content_url('plugins/wp-rescuemode-ai');
$css_url = $plugin_url . '/assets/build/css/rescue.css?ver=' . $ver;
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