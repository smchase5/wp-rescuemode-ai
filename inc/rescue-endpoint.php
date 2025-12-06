<?php
/**
 * Rescue endpoint for diagnostics and safe actions.
 *
 * @package WP_RescueMode_AI
 */

namespace WPRAI;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if (!defined('ABSPATH')) {
	exit;
}

/**
 * REST controller for rescue mode.
 */
class Rescue_Endpoint
{
	/**
	 * @var Plugin
	 */
	private $plugin;

	/**
	 * Route namespace.
	 *
	 * @var string
	 */
	private $namespace = 'wp-rescuemode/v1';

	/**
	 * Constructor.
	 *
	 * @param Plugin $plugin Plugin instance.
	 */
	public function __construct(Plugin $plugin)
	{
		$this->plugin = $plugin;
	}

	/**
	 * Register routes.
	 */
	public function register_routes()
	{
		register_rest_route(
			$this->namespace,
			'/diagnose',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [$this, 'handle_diagnose'],
				'permission_callback' => [$this, 'validate_rescue_token'],
				'args' => [
					'token' => [
						'type' => 'string',
						'required' => true,
					],
					'apply_fix' => [
						'type' => 'boolean',
						'required' => false,
						'default' => false,
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/generate-email',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [$this, 'handle_generate_email'],
				'permission_callback' => [$this, 'validate_rescue_token_or_cap'],
				'args' => [
					'token' => [
						'type' => 'string',
						'required' => false,
					],
					'context' => [
						'type' => 'string',
						'required' => false,
						'default' => 'rescue',
					],
					'issue' => [
						'type' => 'string',
						'required' => false,
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/regenerate-token',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [$this, 'handle_regenerate_token'],
				'permission_callback' => function () {
					return current_user_can('manage_options');
				},
			]
		);

		register_rest_route(
			$this->namespace,
			'/settings',
			[
				[
					'methods' => WP_REST_Server::READABLE,
					'callback' => [$this, 'handle_get_settings'],
					'permission_callback' => function () {
						return current_user_can('manage_options');
					},
				],
				[
					'methods' => WP_REST_Server::CREATABLE,
					'callback' => [$this, 'handle_save_settings'],
					'permission_callback' => function () {
						return current_user_can('manage_options');
					},
					'args' => [
						'openai_key' => [
							'type' => 'string',
							'required' => false,
						],
						'ai_model' => [
							'type' => 'string',
							'required' => false,
						],
						'ai_temperature' => [
							'type' => 'number',
							'required' => false,
						],
						'auto_activate' => [
							'type' => 'boolean',
							'required' => false,
						],
						'email_notifications' => [
							'type' => 'boolean',
							'required' => false,
						],
						'notification_email' => [
							'type' => 'string',
							'required' => false,
						],
					],
				],
			]
		);
	}

	/**
	 * Permission check against stored rescue token.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return true|WP_Error
	 */
	public function validate_rescue_token(WP_REST_Request $request)
	{
		$token = $request->get_param('token');
		$valid = get_option(Plugin::OPTION_RESCUE_TOKEN);

		if (!$token || !$valid || !is_string($valid)) {
			return new WP_Error('wprai_invalid_token', __('Rescue token missing or not configured.', 'wp-rescuemode-ai'), ['status' => 401]);
		}

		if (!hash_equals($valid, (string) $token)) {
			return new WP_Error('wprai_invalid_token', __('Invalid rescue token.', 'wp-rescuemode-ai'), ['status' => 401]);
		}

		return true;
	}

	/**
	 * Permission callback that allows either token or manage_options.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public function validate_rescue_token_or_cap(WP_REST_Request $request)
	{
		$token = $request->get_param('token');
		if ($token) {
			return $this->validate_rescue_token($request);
		}

		if (current_user_can('manage_options')) {
			return true;
		}

		return new WP_Error('wprai_forbidden', __('Not authorized.', 'wp-rescuemode-ai'), ['status' => 403]);
	}

	/**
	 * Handle diagnose request (placeholder until AI wiring).
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_diagnose(WP_REST_Request $request)
	{
		$log_path = wprai_get_debug_log_path();
		$raw_lines = $log_path ? wprai_tail_file($log_path, 200, 200000) : [];
		$log_lines = wprai_sanitize_log_lines($raw_lines);
		$suspicions = wprai_detect_plugins_from_log($log_lines);
		$plugins = wprai_get_plugins_data();
		$apply_fix = (bool) $request->get_param('apply_fix');
		$actions = [];
		$fix_applied = false;
		$ai_summary = null;

		// Enrich suspicions with friendly names
		// Enrich suspicions with friendly names
		foreach ($suspicions as &$suspicion) {
			$suspicion['name'] = $suspicion['slug']; // Fallback

			// Clean slug if it has the disabled suffix
			$clean_slug = str_replace('.disabled-wpra', '', $suspicion['slug']);

			foreach ($plugins as $plugin) {
				$plugin_folder = dirname($plugin['file']);
				// Check if folder matches clean slug OR clean slug + suffix
				if ($plugin_folder === $clean_slug || $plugin_folder === $clean_slug . '.disabled-wpra') {
					$suspicion['name'] = $plugin['name'];
					break;
				}
			}
		}
		unset($suspicion);

		if ($apply_fix && !empty($suspicions)) {
			$target_slug = $suspicions[0]['slug'];
			$target_file = null;
			foreach ($plugins as $plugin) {
				$folder = explode('/', $plugin['file'])[0];
				if ($folder === $target_slug) {
					$target_file = $plugin['file'];
					break;
				}
			}

			// If not found in active plugins, it might be because it's already disabled or just a folder
			if (!$target_file) {
				$target_file = $target_slug . '/index.php'; // Dummy path for the helper
			}

			if ($target_file) {
				$result = wprai_disable_plugin_folder($target_file);
				$actions[] = $result;

				// Consider it fixed if it succeeded OR if it was already disabled
				$fix_applied = !empty($result['success']) || (isset($result['message']) && strpos($result['message'], 'already disabled') !== false);
			} else {
				$actions[] = [
					'success' => false,
					'message' => __('Could not map suspected plugin to a folder.', 'wp-rescuemode-ai'),
				];
			}
		}

		$response = [
			'status' => 'ok',
			'message' => __('Diagnostics complete.', 'wp-rescuemode-ai'),
			'environment' => [
				'wp_version' => get_bloginfo('version'),
				'php_version' => phpversion(),
				'debug_log_path' => $log_path,
				'debug_log_exists' => (bool) ($log_path && file_exists($log_path)),
			],
			'active_plugins' => $plugins,
			'debug_log_tail' => $log_lines,
			'suspicions' => $suspicions,
			'actions' => $actions,
			'fix_applied' => $fix_applied,
			'rescue_url_hint' => $this->plugin->get_rescue_url(),
			'ai_summary' => null,
		];

		$ai = $this->plugin->get_ai_client();
		if ($ai->is_configured()) {
			$messages = [
				[
					'role' => 'system',
					'content' => 'You are an expert WordPress troubleshooter. Summarize the likely cause of the error and which plugin to deactivate. Keep it under 120 words.',
				],
				[
					'role' => 'user',
					'content' => 'Recent debug log tail:' . "\n" . implode("\n", array_slice($log_lines, -50)),
				],
			];

			$ai_response = $ai->chat(
				$messages,
				[
					'max_tokens' => 200,
					'temperature' => (float) get_option(Plugin::OPTION_AI_TEMPERATURE, 0.3),
					'model' => get_option(Plugin::OPTION_AI_MODEL, 'gpt-4o-mini'),
				]
			);

			if (!is_wp_error($ai_response) && isset($ai_response['choices'][0]['message']['content'])) {
				$response['ai_summary'] = $ai_response['choices'][0]['message']['content'];
			} else {
				$response['ai_summary'] = null;
			}
		}

		return new WP_REST_Response($response, 200);
	}

	/**
	 * Generate developer email draft using AI if available.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_generate_email(WP_REST_Request $request)
	{
		$context = $request->get_param('context');
		$issue = $request->get_param('issue');
		$log_path = wprai_get_debug_log_path();
		$log_lines = wprai_sanitize_log_lines($log_path ? wprai_tail_file($log_path, 80, 120000) : []);
		$plugins = wprai_get_plugins_data();
		$suspects = wprai_detect_plugins_from_log($log_lines);

		$ai = $this->plugin->get_ai_client();
		$text = '';

		if ($ai->is_configured()) {
			$messages = [
				[
					'role' => 'system',
					'content' => 'Draft a concise email to a WordPress plugin developer describing the issue, key errors, and steps taken. Keep it under 220 words. Be polite and clear.',
				],
				[
					'role' => 'user',
					'content' => wp_json_encode(
						[
							'context' => $context,
							'issue' => $issue,
							'suspected_plugins' => $suspects,
							'log_excerpt' => array_slice($log_lines, -40),
							'site' => [
								'url' => site_url(),
								'wp_version' => get_bloginfo('version'),
								'php' => phpversion(),
							],
							'actions_taken' => [
								'rescue_mode_visited' => true,
								'fix_applied' => false,
							],
						]
					),
				],
			];

			$ai_response = $ai->chat(
				$messages,
				[
					'max_tokens' => 380,
					'temperature' => (float) get_option(Plugin::OPTION_AI_TEMPERATURE, 0.3),
					'model' => get_option(Plugin::OPTION_AI_MODEL, 'gpt-4o-mini'),
				]
			);

			if (!is_wp_error($ai_response) && isset($ai_response['choices'][0]['message']['content'])) {
				$text = $ai_response['choices'][0]['message']['content'];
			}
		}

		if (empty($text)) {
			$text = "Hi there,\n\nMy WordPress site is experiencing a critical error. Key details:\n- WordPress: " . get_bloginfo('version') . "\n- PHP: " . phpversion() . "\n- Suspected plugins: " . (empty($suspects) ? 'unknown' : implode(', ', wp_list_pluck($suspects, 'slug'))) . "\n\nRecent errors:\n" . implode("\n", array_slice($log_lines, -10)) . "\n\nSteps taken: visited Rescue Mode, collected logs.\nThanks for taking a look.";
		}

		return new WP_REST_Response(
			[
				'status' => 'ok',
				'email' => $text,
				'source' => $ai->is_configured() ? 'openai' : 'fallback',
			],
			200
		);
	}
	/**
	 * Regenerate rescue token.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_regenerate_token(WP_REST_Request $request)
	{
		$new_token = $this->plugin->generate_and_store_rescue_token();
		$new_url = $this->plugin->get_rescue_url();

		return new WP_REST_Response(
			[
				'status' => 'ok',
				'token' => $new_token,
				'url' => $new_url,
			],
			200
		);
	}


	/**
	 * Get current settings.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function handle_get_settings(WP_REST_Request $request)
	{
		return new WP_REST_Response(
			[
				'openai_key' => get_option(Plugin::OPTION_OPENAI_KEY, ''),
				'ai_model' => get_option(Plugin::OPTION_AI_MODEL, 'gpt-4o-mini'),
				'ai_temperature' => (float) get_option(Plugin::OPTION_AI_TEMPERATURE, 0.3),
				'auto_activate' => (bool) get_option(Plugin::OPTION_AUTO_ACTIVATE, true),
				'email_notifications' => (bool) get_option(Plugin::OPTION_EMAIL_NOTIFICATIONS, false),
				'notification_email' => get_option(Plugin::OPTION_NOTIFICATION_EMAIL, ''),
			],
			200
		);
	}

	/**
	 * Save settings.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function handle_save_settings(WP_REST_Request $request)
	{
		$params = $request->get_json_params();

		if (isset($params['openai_key'])) {
			update_option(Plugin::OPTION_OPENAI_KEY, sanitize_text_field($params['openai_key']));
		}

		if (isset($params['ai_model'])) {
			update_option(Plugin::OPTION_AI_MODEL, sanitize_text_field($params['ai_model']));
		}

		if (isset($params['ai_temperature'])) {
			update_option(Plugin::OPTION_AI_TEMPERATURE, (float) $params['ai_temperature']);
		}

		if (isset($params['auto_activate'])) {
			update_option(Plugin::OPTION_AUTO_ACTIVATE, (bool) $params['auto_activate']);
		}

		if (isset($params['email_notifications'])) {
			update_option(Plugin::OPTION_EMAIL_NOTIFICATIONS, (bool) $params['email_notifications']);
		}

		if (isset($params['notification_email'])) {
			update_option(Plugin::OPTION_NOTIFICATION_EMAIL, sanitize_email($params['notification_email']));
		}

		return new WP_REST_Response(['status' => 'ok'], 200);
	}
}
