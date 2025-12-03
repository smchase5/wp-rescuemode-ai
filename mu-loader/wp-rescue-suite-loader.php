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

$request_uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
$is_rescue_request = (!empty($request_uri) && preg_match('#/wp-rescue(/?$|\?)#', $request_uri));

if (defined('WP_CONTENT_DIR')) {
	file_put_contents(WP_CONTENT_DIR . '/mu-loader-debug.log', "Request URI: " . $_SERVER['REQUEST_URI'] . " | Is Rescue: " . ($is_rescue_request ? 'YES' : 'NO') . "\n", FILE_APPEND);
}

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
	add_action(
		'template_redirect',
		static function () {
			$token = isset($_GET['token']) ? sanitize_text_field(wp_unslash($_GET['token'])) : '';
			$stored = get_option('wprai_rescue_token');

			if (empty($token) || !is_string($stored) || !hash_equals($stored, $token)) {
				status_header(401);
				wp_die(esc_html__('Invalid or missing rescue token.', 'wp-rescuemode-ai'));
			}

			$css_url = plugins_url('assets/build/css/rescue.css', '/wp-rescuemode-ai/wp-rescuemode-ai.php');
			$js_url = plugins_url('assets/build/js/rescue.js', '/wp-rescuemode-ai/wp-rescuemode-ai.php');

			nocache_headers();
			status_header(200);
			?>
		<!DOCTYPE html>
		<html <?php language_attributes(); ?>>

		<head>
			<meta charset="<?php bloginfo('charset'); ?>">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title><?php esc_html_e('WP RescueMode AI', 'wp-rescuemode-ai'); ?></title>
			<link rel="stylesheet" href="<?php echo esc_url($css_url); ?>" />
		</head>

		<body class="wprai-rescue-body">
			<div id="wprai-rescue-root" class="wprai-rescue-shell"
				data-endpoint="<?php echo esc_attr(rest_url('wp-rescuemode/v1/diagnose')); ?>"
				data-email-endpoint="<?php echo esc_attr(rest_url('wp-rescuemode/v1/generate-email')); ?>"
				data-token="<?php echo esc_attr($token); ?>"
				data-rescue-url="<?php echo esc_attr(site_url('/wp-rescue?token=' . rawurlencode($token))); ?>">
				<div class="wprai-rescue-header">
					<div>
						<div class="wprai-badge"><?php esc_html_e('WP Rescue Suite', 'wp-rescuemode-ai'); ?></div>
						<h1><?php esc_html_e('Rescue Mode', 'wp-rescuemode-ai'); ?></h1>
						<p class="wprai-subtle">
							<?php esc_html_e('AI will read your latest debug log, spot failing plugins, and can safely disable them.', 'wp-rescuemode-ai'); ?>
						</p>
					</div>
					<div class="wprai-chip success"><?php esc_html_e('Token verified', 'wp-rescuemode-ai'); ?></div>
				</div>

				<div class="wprai-rescue-grid">
					<div class="wprai-card wprai-rescue-hero">
						<h3><?php esc_html_e('Check my site', 'wp-rescuemode-ai'); ?></h3>
						<p class="wprai-subtle">
							<?php esc_html_e('Step 1: Diagnose. Step 2: Apply fix to turn off the problem plugin.', 'wp-rescuemode-ai'); ?>
						</p>
						<div class="wprai-hero-button-wrap">
							<button class="wprai-button wprai-button-large"
								data-wprai-rescue-run="diagnose"><?php esc_html_e('Diagnose', 'wp-rescuemode-ai'); ?></button>
							<button class="wprai-button ghost"
								data-wprai-rescue-run="fix"><?php esc_html_e('Apply fix', 'wp-rescuemode-ai'); ?></button>
						</div>
						<div class="wprai-status-lite">
							<p class="wprai-status-label"><?php esc_html_e('Status', 'wp-rescuemode-ai'); ?></p>
							<p class="wprai-status-value" id="wprai-rescue-status">
								<?php esc_html_e('Waiting to run…', 'wp-rescuemode-ai'); ?>
							</p>
						</div>
						<div class="wprai-suspect-row" id="wprai-rescue-suspects">
							<?php esc_html_e('No suspects yet.', 'wp-rescuemode-ai'); ?>
						</div>
					</div>
					<div class="wprai-card">
						<h3><?php esc_html_e('Recent errors', 'wp-rescuemode-ai'); ?></h3>
						<p class="wprai-subtle">
							<?php esc_html_e('Latest debug log lines to show what went wrong.', 'wp-rescuemode-ai'); ?>
						</p>
						<div id="wprai-rescue-loglist" class="wprai-loglist"></div>
					</div>
					<div class="wprai-card">
						<h3><?php esc_html_e('Developer email', 'wp-rescuemode-ai'); ?></h3>
						<p class="wprai-subtle">
							<?php esc_html_e('Generate a clear email for your plugin developer.', 'wp-rescuemode-ai'); ?>
						</p>
						<div class="wprai-inline-actions">
							<button class="wprai-button"
								data-wprai-email="generate"><?php esc_html_e('Generate Email', 'wp-rescuemode-ai'); ?></button>
							<button class="wprai-button ghost"
								data-wprai-email-copy="1"><?php esc_html_e('Copy', 'wp-rescuemode-ai'); ?></button>
						</div>
						<textarea id="wprai-rescue-email" class="wprai-log" style="min-height:160px;" readonly></textarea>
					</div>
				</div>
			</div>
			<script src="<?php echo esc_url($js_url); ?>"></script>
		</body>

		</html>
		<?php
			exit;
		},
		-1000
	);
}

if (file_exists($plugin_dir)) {
	include_once $plugin_dir;
}
