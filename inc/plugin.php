<?php
/**
 * Core plugin bootstrap.
 *
 * @package WP_RescueMode_AI
 */

namespace WPRAI;

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Main plugin class.
 */
class Plugin
{
	const OPTION_RESCUE_TOKEN = 'wprai_rescue_token';
	const OPTION_OPENAI_KEY = 'wprai_openai_api_key';
	const TRANSIENT_SCAN_STATE = 'wprai_conflict_scan_state';
	const OPTION_MU_LOADER_STATUS = 'wprai_mu_loader_status';

	/**
	 * @var Plugin
	 */
	private static $instance;

	/**
	 * @var Rescue_Endpoint
	 */
	private $rescue_endpoint;

	/**
	 * @var Conflict_Scanner_Endpoint
	 */
	private $conflict_endpoint;

	/**
	 * Singleton accessor.
	 *
	 * @return Plugin
	 */
	public static function instance()
	{
		if (!self::$instance) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Initialize hooks.
	 */
	public function boot()
	{
		$this->maybe_generate_rescue_token();

		$this->maybe_install_mu_loader();

		add_action('init', [$this, 'register_rewrite']);
		add_filter('query_vars', [$this, 'add_query_vars']);
		add_action('template_redirect', [$this, 'maybe_render_rescue_page']);
		add_action('admin_menu', [$this, 'register_admin_page']);
		add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
		add_action('rest_api_init', [$this, 'register_endpoints']);
		add_action('admin_notices', [$this, 'maybe_show_mu_loader_notice']);
		add_filter('script_loader_tag', [$this, 'add_type_attribute'], 10, 3);
	}

	/**
	 * Add type="module" to scripts.
	 *
	 * @param string $tag    The script tag.
	 * @param string $handle The script handle.
	 * @param string $src    The script src.
	 * @return string
	 */
	public function add_type_attribute($tag, $handle, $src)
	{
		if ('wprai-admin' !== $handle && 'wprai-rescue' !== $handle) {
			return $tag;
		}

		return '<script type="module" src="' . esc_url($src) . '"></script>';
	}

	/**
	 * Activation tasks.
	 */
	public function on_activation()
	{
		$this->maybe_generate_rescue_token();
		$this->register_rewrite();
		flush_rewrite_rules(false);
		$this->install_mu_loader();
	}

	/**
	 * Register REST endpoints.
	 */
	public function register_endpoints()
	{
		$this->rescue_endpoint = new Rescue_Endpoint($this);
		$this->conflict_endpoint = new Conflict_Scanner_Endpoint($this);

		$this->rescue_endpoint->register_routes();
		$this->conflict_endpoint->register_routes();
	}

	/**
	 * Deactivation tasks.
	 */
	public function on_deactivation()
	{
		flush_rewrite_rules(false);
	}

	/**
	 * Register admin page under Tools.
	 */
	public function register_admin_page()
	{
		add_menu_page(
			__('WP RescueMode AI', 'wp-rescuemode-ai'),
			__('WP RescueMode AI', 'wp-rescuemode-ai'),
			'manage_options',
			'wprai-main',
			function () {
				$this->render_admin_page('dashboard');
			},
			'dashicons-shield-alt',
			58
		);
	}

	/**
	 * Enqueue admin assets (bundled CSS/JS).
	 */
	public function enqueue_admin_assets()
	{
		$screen = get_current_screen();
		if (empty($screen) || false === strpos($screen->id, 'wprai')) {
			return;
		}

		$tailwind_path = WPRAI_PLUGIN_DIR . 'assets/build/css/tailwind.css';
		if (file_exists($tailwind_path)) {
			wp_enqueue_style('wprai-tailwind', WPRAI_PLUGIN_URL . 'assets/build/css/tailwind.css', [], WPRAI_VERSION);
		}

		$css_path = WPRAI_PLUGIN_DIR . 'assets/build/css/admin.css';
		if (file_exists($css_path)) {
			wp_enqueue_style('wprai-admin', WPRAI_PLUGIN_URL . 'assets/build/css/admin.css', ['wprai-tailwind'], WPRAI_VERSION);
		}

		$js_path = WPRAI_PLUGIN_DIR . 'assets/build/js/admin.js';
		if (file_exists($js_path)) {
			wp_enqueue_script('wprai-admin', WPRAI_PLUGIN_URL . 'assets/build/js/admin.js', [], WPRAI_VERSION, true);
			wp_localize_script(
				'wprai-admin',
				'wpraiAdmin',
				[
					'restUrl' => esc_url_raw(rest_url('wp-rescuemode/v1/')),
					'token' => $this->get_rescue_token(),
					'nonce' => wp_create_nonce('wp_rest'),
					'rescueUrl' => $this->get_rescue_url(),
					'wpVersion' => get_bloginfo('version'),
					'phpVersion' => phpversion(),
					'debugLog' => (defined('WP_DEBUG_LOG') && WP_DEBUG_LOG),
				]
			);
		}
	}

	/**
	 * Render the main admin dashboard.
	 * Render the main admin dashboard or sub-pages.
	 *
	 * @param string $section Section slug.
	 */
	public function render_admin_page($section = 'dashboard')
	{
		?>
		<div id="wp-rescuemode-ai-admin-root" class="wprai-react-root"></div>
		<?php
	}

	/**
	 * Register rewrite for /wp-rescue.
	 */
	public function register_rewrite()
	{
		add_rewrite_rule('^wp-rescue/?$', 'index.php?wp_rescue=1', 'top');
	}

	/**
	 * Add public query vars.
	 *
	 * @param array $vars Vars.
	 * @return array
	 */
	public function add_query_vars($vars)
	{
		$vars[] = 'wp_rescue';
		return $vars;
	}

	/**
	 * Render the token-protected rescue UI when hitting /wp-rescue.
	 */
	public function maybe_render_rescue_page()
	{
		$is_rescue_query = get_query_var('wp_rescue');
		$is_rescue_path = isset($_SERVER['REQUEST_URI']) && false !== strpos(sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])), '/wp-rescue');

		if (!$is_rescue_query && !$is_rescue_path) {
			return;
		}

		$token = isset($_GET['token']) ? sanitize_text_field(wp_unslash($_GET['token'])) : '';
		if (!$token || !hash_equals($this->get_rescue_token(), $token)) {
			status_header(401);
			wp_die(esc_html__('Invalid or missing rescue token.', 'wp-rescuemode-ai'));
		}

		nocache_headers();
		status_header(200);

		$css_url = WPRAI_PLUGIN_URL . 'assets/build/css/rescue.css';
		$tailwind_url = WPRAI_PLUGIN_URL . 'assets/build/css/tailwind.css';
		$js_url = WPRAI_PLUGIN_URL . 'assets/build/js/rescue.js';
		?>
		<!DOCTYPE html>
		<html <?php language_attributes(); ?>>

		<head>
			<meta charset="<?php bloginfo('charset'); ?>">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title><?php esc_html_e('WP RescueMode AI', 'wp-rescuemode-ai'); ?></title>
			<link rel="stylesheet" href="<?php echo esc_url($tailwind_url); ?>" />
			<link rel="stylesheet" href="<?php echo esc_url($css_url); ?>" />
		</head>

		<body class="wprai-rescue-body">
			<div id="wprai-rescue-root" class="wprai-rescue-shell"
				data-endpoint="<?php echo esc_attr(rest_url('wp-rescuemode/v1/diagnose')); ?>"
				data-email-endpoint="<?php echo esc_attr(rest_url('wp-rescuemode/v1/generate-email')); ?>"
				data-token="<?php echo esc_attr($token); ?>" data-rescue-url="<?php echo esc_attr($this->get_rescue_url()); ?>">
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
					<div class="wprai-card">
						<h3><?php esc_html_e('AI Actions', 'wp-rescuemode-ai'); ?></h3>
						<p class="wprai-subtle">
							<?php esc_html_e('Let AI diagnose or apply a safe plugin disable if it finds a likely culprit.', 'wp-rescuemode-ai'); ?>
						</p>
						<div class="wprai-inline-actions">
							<button class="wprai-button"
								data-wprai-rescue-run="diagnose"><?php esc_html_e('Diagnose', 'wp-rescuemode-ai'); ?></button>
							<button class="wprai-button ghost"
								data-wprai-rescue-run="fix"><?php esc_html_e('Diagnose + Apply fix', 'wp-rescuemode-ai'); ?></button>
						</div>
						<pre id="wprai-rescue-output" class="wprai-log"></pre>
					</div>
					<div class="wprai-card">
						<h3><?php esc_html_e('Recent Errors', 'wp-rescuemode-ai'); ?></h3>
						<p class="wprai-subtle">
							<?php esc_html_e('We will show the tail of debug.log so you can spot patterns quickly.', 'wp-rescuemode-ai'); ?>
						</p>
						<pre id="wprai-rescue-log" class="wprai-log"></pre>
					</div>
					<div class="wprai-card">
						<h3><?php esc_html_e('Developer Email', 'wp-rescuemode-ai'); ?></h3>
						<p class="wprai-subtle">
							<?php esc_html_e('Generate a clear email for your plugin developer with the latest errors.', 'wp-rescuemode-ai'); ?>
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
			<script type="module" src="<?php echo esc_url($js_url); ?>"></script>
		</body>

		</html>
		<?php
		exit;
	}

	/**
	 * Get or create rescue token.
	 *
	 * @return string
	 */
	public function get_rescue_token()
	{
		return $this->maybe_generate_rescue_token();
	}

	/**
	 * Get rescue URL with token.
	 *
	 * @return string
	 */
	public function get_rescue_url()
	{
		return site_url('/wp-rescue?token=' . rawurlencode($this->get_rescue_token()));
	}

	/**
	 * Get AI client.
	 *
	 * @return AI_Client
	 */
	public function get_ai_client()
	{
		$key = get_option(self::OPTION_OPENAI_KEY, '');
		return new AI_Client($key);
	}

	/**
	 * Get or create rescue token.
	 *
	 * @return string
	 */
	private function maybe_generate_rescue_token()
	{
		$token = get_option(self::OPTION_RESCUE_TOKEN);

		if (empty($token) || !is_string($token)) {
			$token = $this->generate_and_store_rescue_token();
		}

		return $token;
	}

	/**
	 * Generate token and persist.
	 *
	 * @return string
	 */
	private function generate_and_store_rescue_token()
	{
		$token = wp_generate_password(24, false, false);
		update_option(self::OPTION_RESCUE_TOKEN, $token, false);

		return $token;
	}

	/**
	 * Try to install the MU loader automatically.
	 *
	 * @return bool
	 */
	private function install_mu_loader()
	{
		$target_dir = WP_CONTENT_DIR . '/mu-plugins';
		$target = $target_dir . '/wp-rescue-suite-loader.php';
		$source = WPRAI_PLUGIN_DIR . 'mu-loader/wp-rescue-suite-loader.php';

		if (file_exists($target)) {
			// Force update for development to ensure fixes propagate
			// update_option(self::OPTION_MU_LOADER_STATUS, 'installed', false);
			// return true;
			unlink($target);
		}

		if (!file_exists($source)) {
			update_option(self::OPTION_MU_LOADER_STATUS, 'missing_source', false);
			return false;
		}

		if (!is_dir($target_dir) && !wp_mkdir_p($target_dir)) {
			update_option(self::OPTION_MU_LOADER_STATUS, 'cannot_create_dir', false);
			return false;
		}

		if (!copy($source, $target)) {
			update_option(self::OPTION_MU_LOADER_STATUS, 'copy_failed', false);
			return false;
		}

		update_option(self::OPTION_MU_LOADER_STATUS, 'installed', false);
		return true;
	}

	/**
	 * Attempt install if missing.
	 */
	private function maybe_install_mu_loader()
	{
		$target = WP_CONTENT_DIR . '/mu-plugins/wp-rescue-suite-loader.php';
		// Always try to install/update for now to ensure fixes propagate
		$this->install_mu_loader();
	}

	/**
	 * Admin notice if MU loader missing.
	 */
	public function maybe_show_mu_loader_notice()
	{
		if (!current_user_can('manage_options')) {
			return;
		}

		$status = get_option(self::OPTION_MU_LOADER_STATUS);
		$target = WP_CONTENT_DIR . '/mu-plugins/wp-rescue-suite-loader.php';
		if ('installed' === $status && file_exists($target)) {
			return;
		}

		$message = __('WP RescueMode AI could not place its MU loader. The rescue URL may fail if other plugins crash the site.', 'wp-rescuemode-ai');
		echo '<div class="notice notice-warning"><p>' . esc_html($message) . '</p></div>';
	}
}
