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
	}

	/**
	 * Permission check.
	 *
	 * @return true|WP_Error
	 */
	public function can_manage()
	{
		if (current_user_can('manage_options')) {
			return true;
		}

		return new WP_Error('wprai_forbidden', __('You do not have permission to run scans.', 'wp-rescuemode-ai'), ['status' => 403]);
	}

	/**
	 * Get list of active plugins.
	 *
	 * @return WP_REST_Response
	 */
	public function get_plugins()
	{
		$plugins = wprai_get_plugins_data();
		$active = array_values(
			array_filter(
				$plugins,
				static function ($plugin) {
					// Must be active and NOT be us.
					return !empty($plugin['is_active']) && false === strpos($plugin['file'], 'wp-rescuemode-ai');
				}
			)
		);

		// Debug logging
		$log_file = plugin_dir_path(dirname(__FILE__)) . 'debug_trace.log';
		file_put_contents($log_file, "WPRAI Scanner: Found " . count($active) . " active plugins after filter.\n", FILE_APPEND);
		file_put_contents($log_file, "WPRAI Scanner: Filtered list: " . print_r($active, true) . "\n", FILE_APPEND);

		// Format for frontend
		$nodes = array_map(
			static function ($p) {
				return [
					'id' => md5($p['file']),
					'file' => $p['file'],
					'name' => $p['name'],
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
	public function start_scan()
	{
		$plugins = wprai_get_plugins_data();
		$active = array_values(
			array_filter(
				$plugins,
				static function ($plugin) {
					return !empty($plugin['is_active']);
				}
			)
		);

		// Save snapshot
		set_transient(Plugin::TRANSIENT_SCAN_STATE, ['active' => $active], HOUR_IN_SECONDS);

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

		if (!$file) {
			return new WP_REST_Response(['status' => 'error', 'message' => 'No file provided'], 400);
		}

		// Capture log baseline
		$debug_path = wprai_get_debug_log_path();
		$baseline = $debug_path ? wprai_tail_file($debug_path, 50, 50000) : [];

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

			if (stripos($line, 'Fatal error') !== false || stripos($line, 'Parse error') !== false) {
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
	 * @return WP_REST_Response
	 */
	public function restore_plugins()
	{
		$state = get_transient(Plugin::TRANSIENT_SCAN_STATE);
		if (!$state || empty($state['active'])) {
			return new WP_REST_Response(['success' => false, 'message' => 'No snapshot found.'], 200);
		}

		$files = array_column($state['active'], 'file');
		activate_plugins($files);

		delete_transient(Plugin::TRANSIENT_SCAN_STATE);

		return new WP_REST_Response(['success' => true, 'message' => 'Restored.'], 200);
	}
}
