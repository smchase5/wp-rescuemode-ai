<?php
/**
 * Conflict scanner REST endpoints (stubbed state machine).
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
 * Conflict scanner controller.
 */
class Conflict_Scanner_Endpoint
{
	/**
	 * @var Plugin
	 */
	private $plugin;

	/**
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
			'/scan/plugins',
			[
				'methods' => WP_REST_Server::READABLE,
				'callback' => [$this, 'get_plugins'],
				'permission_callback' => [$this, 'can_manage'],
			]
		);

		register_rest_route(
			$this->namespace,
			'/scan/start',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [$this, 'start_scan'],
				'permission_callback' => [$this, 'can_manage'],
			]
		);

		register_rest_route(
			$this->namespace,
			'/scan/test',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [$this, 'test_plugin'],
				'permission_callback' => [$this, 'can_manage'],
			]
		);

		register_rest_route(
			$this->namespace,
			'/scan/restore',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [$this, 'restore_plugins'],
				'permission_callback' => [$this, 'can_manage'],
			]
		);

		register_rest_route(
			$this->namespace,
			'/scan/analyze',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [$this, 'analyze_results'],
				'permission_callback' => [$this, 'can_manage'],
			]
		);
	}

	/**
	 * Permission check.
	 * Allows 'manage_options' cap OR a valid rescue token.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public function can_manage(WP_REST_Request $request)
	{
		// 1. Admin check
		if (current_user_can('manage_options')) {
			return true;
		}

		// 2. Token check
		$token = $request->get_param('token');
		if (!$token) {
			$token = $request->get_header('x_rescue_token');
		}

		if ($token) {
			$valid = get_option(Plugin::OPTION_RESCUE_TOKEN);
			if ($valid && is_string($valid) && hash_equals($valid, (string) $token)) {
				return true;
			}
		}

		return new WP_REST_Response([
			'code' => 'wprai_forbidden',
			'message' => __('You do not have permission to run scans.', 'wp-rescuemode-ai'),
			'data' => ['status' => 403]
		], 403);
	}

	/**
	 * Get list of active plugins.
	 *
	 * @return WP_REST_Response
	 */
	public function get_plugins()
	{
		// Check if we have a saved state from an interrupted scan
		$state = get_transient(Plugin::TRANSIENT_SCAN_STATE);
		if ($state && !empty($state['active']) && is_array($state['active'])) {
			$plugins = $state['active'];
			// These are already formatted with 'file', 'name', 'is_active' from the snapshot
		} else {
			// Fallback to current state
			$plugins = wprai_get_plugins_data();
			// Filter to only active ones if coming from raw list
			$plugins = array_filter(
				$plugins,
				static function ($plugin) {
					return !empty($plugin['is_active']);
				}
			);
		}

		$active = array_values(
			array_filter(
				$plugins,
				static function ($plugin) {
					// Must be active (already checked above or in snapshot) and NOT be us.
					// Note: Snapshot 'active' list implies is_active=true.
					return false === strpos($plugin['file'], 'wp-rescuemode-ai');
				}
			)
		);

		// Format for frontend
		$nodes = array_map(
			static function ($p) {
				return [
					'id' => md5($p['file']),
					'file' => $p['file'],
					'name' => isset($p['name']) ? $p['name'] : $p['file'],
					'status' => 'pending',
				];
			},
			$active
		);

		return new WP_REST_Response($nodes, 200);
	}

	/**
	 * Start scan: Snapshot and deactivate all.
	 *
	 * @return WP_REST_Response
	 */
	public function start_scan(WP_REST_Request $request)
	{
		$mode = $request->get_param('mode');
		if ($mode === 'admin') {
			// Virtual Scan: Do NOT deactivate plugins.
			// Just verify logs are accessible.
			$log_path = wprai_get_debug_log_path();
			if (!$log_path || !is_writable(dirname($log_path))) {
				// We can't easily force WP_DEBUG via plugin if it's off in wp-config.
				// But we can check if it's working.
				// For now, let's just proceed. The helper tries its best.
			}
			return new WP_REST_Response(['success' => true, 'message' => 'Virtual environment ready.'], 200);
		}

		$plugins = wprai_get_plugins_data();
		$active = array_values(
			array_filter(
				$plugins,
				static function ($plugin) {
					return !empty($plugin['is_active']);
				}
			)
		);

		// Check if we already have a snapshot. If so, DO NOT overwrite it, 
		// because we might be in a "crashed/stripped" state and we don't want to lose the original state.
		$existing = get_transient(Plugin::TRANSIENT_SCAN_STATE);
		if (!$existing || empty($existing['active'])) {
			// Save snapshot only if one doesn't exist
			set_transient(Plugin::TRANSIENT_SCAN_STATE, ['active' => $active], HOUR_IN_SECONDS);
		} else {
			// Use the existing snapshot for deactivation logic?
			// Actually, we probably want to ensure everything is off except us.
			// The deactivate_plugins call below handles "current" active ones, which is fine.
		}

		// Deactivate all except us
		$active_files = array_column($active, 'file');
		$keep = array_filter(
			$active_files,
			static function ($file) {
				return 0 === strpos($file, 'wp-rescuemode-ai/');
			}
		);

		$to_deactivate = array_values(array_diff($active_files, $keep));
		if (!empty($to_deactivate)) {
			deactivate_plugins($to_deactivate, true);
		}


		// Ensure we can read logs
		$log_path = wprai_get_debug_log_path();
		if (!$log_path || !is_writable(dirname($log_path))) {
			// We can't easily force WP_DEBUG via plugin if it's off in wp-config.
			// But we can check if it's working.
			// For now, let's just proceed. The helper tries its best.
		}

		return new WP_REST_Response(['success' => true, 'message' => 'Environment prepared.'], 200);
	}

	/**
	 * Test a single plugin.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function test_plugin(WP_REST_Request $request)
	{
		$file = $request->get_param('file');
		$mode = $request->get_param('mode');

		if (!$file) {
			return new WP_REST_Response(['status' => 'error', 'message' => 'No file provided'], 400);
		}

		// VIRTUAL SCAN LOGIC
		if ($mode === 'admin') {
			$url = site_url('/');
			$args = [
				'headers' => [
					'X-Rescue-Virtual-Plugin' => $file,
				],
				'timeout' => 15, // Allow enough time for PHP processing
				'sslverify' => false, // Local dev often has self-signed certs
			];

			$response = wp_remote_get($url, $args);

			if (is_wp_error($response)) {
				return new WP_REST_Response([
					'status' => 'conflict',
					'message' => 'Request failed: ' . $response->get_error_message()
				], 200);
			}

			$code = wp_remote_retrieve_response_code($response);
			if ($code >= 500) {
				return new WP_REST_Response([
					'status' => 'conflict',
					'message' => "Site returned HTTP $code (Fatal Error likely)."
				], 200);
			}

			// If 200, assume healthy
			return new WP_REST_Response(['status' => 'healthy'], 200);
		}

		// ORIGINAL RESCUE MODE LOGIC (Physical Activation)
		// Capture log baseline
		$debug_path = wprai_get_debug_log_path();
		$baseline = $debug_path ? wprai_tail_file($debug_path, 20, 20000) : [];

		// Activate
		$result = activate_plugin($file, '', false, true);

		if (is_wp_error($result)) {
			return new WP_REST_Response(
				[
					'status' => 'conflict',
					'message' => $result->get_error_message(),
				],
				200
			);
		}

		// Check logs for NEW errors
		$after = $debug_path ? wprai_tail_file($debug_path, 80, 80000) : [];
		$new_lines = array_values(array_diff($after, $baseline));

		// Simple heuristic: if new lines contain "Fatal error" or "Parse error"
		$has_error = false;
		$error_lines = [];
		foreach ($new_lines as $line) {
			// Ignore errors from our own plugin to prevent false positives
			if (false !== strpos($line, 'wp-rescuemode-ai')) {
				continue;
			}

			if (
				stripos($line, 'Fatal error') !== false ||
				stripos($line, 'Parse error') !== false ||
				stripos($line, 'Uncaught Error') !== false ||
				stripos($line, 'syntax error') !== false
			) {
				$has_error = true;
				$error_lines[] = wprai_humanize_error($line);
			}
		}

		// Deactivate immediately
		deactivate_plugins([$file], true);

		if ($has_error) {
			return new WP_REST_Response(
				[
					'status' => 'conflict',
					'message' => implode("\n", $error_lines),
				],
				200
			);
		}

		return new WP_REST_Response(['status' => 'healthy'], 200);
	}

	/**
	 * Restore original state.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function restore_plugins(WP_REST_Request $request)
	{
		$state = get_transient(Plugin::TRANSIENT_SCAN_STATE);
		if (!$state || empty($state['active'])) {
			return new WP_REST_Response(['success' => false, 'message' => 'No snapshot found.'], 200);
		}

		$exclude = $request->get_param('exclude'); // Array of file paths
		if (!is_array($exclude)) {
			$exclude = [];
		}

		$files = array_column($state['active'], 'file');

		// Filter out excluded
		$to_restore = array_diff($files, $exclude);

		if (!empty($to_restore)) {
			activate_plugins($to_restore);
		}

		delete_transient(Plugin::TRANSIENT_SCAN_STATE);

		$message = empty($exclude) ? 'Restored.' : 'Restored with exclusions.';

		return new WP_REST_Response(['success' => true, 'message' => $message], 200);
	}

	/**
	 * Analyze scan results with AI.
	 * 
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function analyze_results(WP_REST_Request $request)
	{
		$conflicts = $request->get_param('conflicts'); // Array of {name, error}

		if (empty($conflicts)) {
			return new WP_REST_Response([
				'summary' => 'No conflicts detected.',
				'recommendation' => 'Your site configuration appears to be stable.',
				'technical_details' => 'No fatal errors were found during the activation scan.',
				'severity' => 'low'
			], 200);
		}

		$prompt = "I ran a conflict scan on my WordPress site and found the following errors. Please analyze them and explain what is wrong in simple terms for a non-technical user. Also provide a recommendation on how to fix it.\n\n";

		foreach ($conflicts as $c) {
			$prompt .= "Plugin: {$c['name']}\nError: {$c['error']}\n---\n";
		}

		$prompt .= "\nProvide the response in JSON format with keys: 'summary', 'recommendation', 'technical_details' (simplified), and 'severity' (high/medium/low).";

		try {
			$ai = $this->plugin->get_ai_client();
			$data = $ai->chat(
				[
					['role' => 'system', 'content' => 'You are a helpful WordPress expert. return only valid JSON.'],
					['role' => 'user', 'content' => $prompt]
				],
				[
					'response_format' => ['type' => 'json_object'],
					'temperature' => 0.4
				]
			);

			$content = json_decode($data['content'], true);

			// Fallback if JSON parsing failed
			if (!$content) {
				throw new \Exception('Invalid JSON from AI');
			}

			return new WP_REST_Response($content, 200);

		} catch (\Exception $e) {
			return new WP_REST_Response([
				'summary' => 'Errors detected, but AI analysis failed.',
				'recommendation' => 'Please check the technical error logs below or contact a developer.',
				'technical_details' => $e->getMessage(),
				'severity' => 'medium'
			], 200);
		}
	}
}
