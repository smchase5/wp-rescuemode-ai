<?php
// Standalone rescue entry that bypasses theme/plugins and renders the rescue UI.

$token = isset( $_GET['token'] ) ? $_GET['token'] : '';

// Pretend this request is /wp-rescue so the MU loader disables other plugins.
$_SERVER['REQUEST_URI'] = '/wp-rescue' . ( $token ? '?token=' . rawurlencode( $token ) : '' );

// Load WordPress (mu-plugins will run and strip other plugins).
$wp_load = dirname( __DIR__ ) . '/wp-load.php';
if ( ! file_exists( $wp_load ) ) {
	http_response_code( 500 );
	echo 'Cannot locate wp-load.php';
	exit;
}

require_once $wp_load;

// If the plugin is active, the normal template_redirect in Plugin::maybe_render_rescue_page will render.
// Otherwise, render a minimal fallback.
if ( function_exists( 'rest_url' ) ) {
	// Trigger the plugin render if not already rendered.
	if ( class_exists( 'WPRAI\Plugin' ) ) {
		WPRAI\Plugin::instance()->maybe_render_rescue_page();
	}
}

// Fallback minimal output.
$stored = get_option( 'wprai_rescue_token' );
if ( empty( $token ) || ! is_string( $stored ) || ! hash_equals( $stored, $token ) ) {
	status_header( 401 );
	wp_die( esc_html__( 'Invalid or missing rescue token.', 'wp-rescuemode-ai' ) );
}

$css_url = plugins_url( 'assets/build/css/rescue.css', __FILE__ );
$js_url  = plugins_url( 'assets/build/js/rescue.js', __FILE__ );
nocache_headers();
status_header( 200 );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php esc_html_e( 'WP RescueMode AI', 'wp-rescuemode-ai' ); ?></title>
	<link rel="stylesheet" href="<?php echo esc_url( $css_url ); ?>" />
</head>
<body class="wprai-rescue-body">
	<div id="wprai-rescue-root"
		class="wprai-rescue-shell"
		data-endpoint="<?php echo esc_attr( rest_url( 'wp-rescuemode/v1/diagnose' ) ); ?>"
		data-email-endpoint="<?php echo esc_attr( rest_url( 'wp-rescuemode/v1/generate-email' ) ); ?>"
		data-token="<?php echo esc_attr( $token ); ?>"
		data-rescue-url="<?php echo esc_attr( site_url( '/wp-rescue?token=' . rawurlencode( $token ) ) ); ?>">
		<div class="wprai-rescue-header">
			<div>
				<div class="wprai-badge"><?php esc_html_e( 'WP Rescue Suite', 'wp-rescuemode-ai' ); ?></div>
				<h1><?php esc_html_e( 'Rescue Mode', 'wp-rescuemode-ai' ); ?></h1>
				<p class="wprai-subtle"><?php esc_html_e( 'AI will read your latest debug log, spot failing plugins, and can safely disable them.', 'wp-rescuemode-ai' ); ?></p>
			</div>
			<div class="wprai-chip success"><?php esc_html_e( 'Token verified', 'wp-rescuemode-ai' ); ?></div>
		</div>

		<div class="wprai-rescue-grid">
			<div class="wprai-card wprai-rescue-hero">
				<h3><?php esc_html_e( 'Check my site', 'wp-rescuemode-ai' ); ?></h3>
				<p class="wprai-subtle"><?php esc_html_e( 'Step 1: Diagnose. Step 2: Apply fix to turn off the problem plugin.', 'wp-rescuemode-ai' ); ?></p>
				<div class="wprai-hero-button-wrap">
					<button class="wprai-button wprai-button-large" data-wprai-rescue-run="diagnose"><?php esc_html_e( 'Diagnose', 'wp-rescuemode-ai' ); ?></button>
					<button class="wprai-button ghost" data-wprai-rescue-run="fix"><?php esc_html_e( 'Apply fix', 'wp-rescuemode-ai' ); ?></button>
				</div>
				<div class="wprai-status-lite">
					<p class="wprai-status-label"><?php esc_html_e( 'Status', 'wp-rescuemode-ai' ); ?></p>
					<p class="wprai-status-value" id="wprai-rescue-status"><?php esc_html_e( 'Waiting to run…', 'wp-rescuemode-ai' ); ?></p>
				</div>
				<div class="wprai-suspect-row" id="wprai-rescue-suspects"><?php esc_html_e( 'No suspects yet.', 'wp-rescuemode-ai' ); ?></div>
			</div>
			<div class="wprai-card">
				<h3><?php esc_html_e( 'Recent errors', 'wp-rescuemode-ai' ); ?></h3>
				<p class="wprai-subtle"><?php esc_html_e( 'Latest debug log lines to show what went wrong.', 'wp-rescuemode-ai' ); ?></p>
				<div id="wprai-rescue-loglist" class="wprai-loglist"></div>
			</div>
			<div class="wprai-card">
				<h3><?php esc_html_e( 'Developer email', 'wp-rescuemode-ai' ); ?></h3>
				<p class="wprai-subtle"><?php esc_html_e( 'Generate a clear email for your plugin developer.', 'wp-rescuemode-ai' ); ?></p>
				<div class="wprai-inline-actions">
					<button class="wprai-button" data-wprai-email="generate"><?php esc_html_e( 'Generate Email', 'wp-rescuemode-ai' ); ?></button>
					<button class="wprai-button ghost" data-wprai-email-copy="1"><?php esc_html_e( 'Copy', 'wp-rescuemode-ai' ); ?></button>
				</div>
				<textarea id="wprai-rescue-email" class="wprai-log" style="min-height:160px;" readonly></textarea>
			</div>
		</div>
	</div>
	<script src="<?php echo esc_url( $js_url ); ?>"></script>
</body>
</html>
