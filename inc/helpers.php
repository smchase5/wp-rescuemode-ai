<?php
/**
 * Helper functions for WP RescueMode AI.
 *
 * @package WP_RescueMode_AI
 */

namespace WPRAI;

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Determine debug log path.
 *
 * @return string|null
 */
function wprai_get_debug_log_path()
{
	if (defined('WP_DEBUG_LOG') && WP_DEBUG_LOG) {
		if (is_string(WP_DEBUG_LOG) && !empty(WP_DEBUG_LOG)) {
			return WP_DEBUG_LOG;
		}

		return WP_CONTENT_DIR . '/debug.log';
	}

	return null;
}

/**
 * Tail a file safely.
 *
 * @param string $path      File path.
 * @param int    $max_lines Max number of lines.
 * @param int    $max_bytes Max bytes to read from end.
 * @return array
 */
function wprai_tail_file($path, $max_lines = 200, $max_bytes = 200000)
{
	if (empty($path) || !file_exists($path) || !is_readable($path)) {
		return [];
	}

	$size = filesize($path);
	$chunk = ($size > $max_bytes) ? $max_bytes : $size;

	$handle = fopen($path, 'r');
	if (!$handle) {
		return [];
	}

	if ($size > $chunk) {
		fseek($handle, -1 * $chunk, SEEK_END);
	}

	$data = fread($handle, $chunk);
	fclose($handle);

	$lines = explode("\n", (string) $data);

	return array_slice($lines, -1 * $max_lines);
}

/**
 * Basic redaction to keep sensitive tokens out of responses.
 *
 * @param array $lines Log lines.
 * @return array
 */
function wprai_sanitize_log_lines($lines)
{
	$patterns = [
		'/password\s*=\s*[^\s]+/i',
		'/pass\s*=\s*[^\s]+/i',
		'/secret\s*=\s*[^\s]+/i',
		'/token\s*=\s*[^\s]+/i',
		'/key\s*=\s*[^\s]+/i',
	];

	$clean = [];
	foreach ((array) $lines as $line) {
		$line = (string) $line;
		foreach ($patterns as $pattern) {
			$line = preg_replace($pattern, '[redacted]', $line);
		}
		$clean[] = $line;
	}

	return $clean;
}

/**
 * Attempt to detect plugin folders mentioned in log lines.
 *
 * @param array $lines Log lines.
 * @return array
 */
function wprai_detect_plugins_from_log($lines)
{
	$matches = [];
	foreach ((array) $lines as $line) {
		if (preg_match('#wp-content/plugins/([^/]+)/#i', (string) $line, $m)) {
			$matches[] = $m[1];
			continue;
		}
		if (preg_match('#Plugin:\s*([a-z0-9\-_]+)#i', (string) $line, $m)) {
			$matches[] = $m[1];
		}
	}

	$matches = array_values(array_unique($matches));

	return array_map(
		static function ($slug) {
			return [
				'slug' => $slug,
				'reason' => __('Detected in recent fatal/warning stack traces.', 'wp-rescuemode-ai'),
			];
		},
		$matches
	);
}

/**
 * Get all plugins with metadata and active status.
 *
 * @return array
 */
function wprai_get_plugins_data()
{
	if (!function_exists('\get_plugins') || !function_exists('\is_plugin_active')) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$plugins = get_plugins();
	$log_file = plugin_dir_path(__DIR__) . 'debug_trace.log';
	file_put_contents($log_file, 'WPRAI Debug: Found ' . count($plugins) . " total plugins.\n", FILE_APPEND);

	$active_option = get_option('active_plugins', []);
	file_put_contents($log_file, "WPRAI Debug: active_plugins option: " . print_r($active_option, true) . "\n", FILE_APPEND);
	file_put_contents($log_file, "WPRAI Debug: is_multisite? " . (is_multisite() ? 'YES' : 'NO') . "\n", FILE_APPEND);

	$list = [];
	foreach ($plugins as $file => $data) {
		$is_active = is_plugin_active($file) || (function_exists('is_plugin_active_for_network') && is_plugin_active_for_network($file));
		// file_put_contents( $log_file, "WPRAI Debug: Plugin $file active? " . ( $is_active ? 'YES' : 'NO' ) . "\n", FILE_APPEND );

		$list[] = [
			'file' => $file,
			'name' => isset($data['Name']) ? (string) $data['Name'] : $file,
			'version' => isset($data['Version']) ? (string) $data['Version'] : '',
			'author' => isset($data['Author']) ? wp_strip_all_tags($data['Author']) : '',
			'is_active' => $is_active,
			'plugin_uri' => isset($data['PluginURI']) ? esc_url_raw($data['PluginURI']) : '',
		];
	}

	return $list;
}

/**
 * Safely rename a plugin folder to disable it.
 *
 * @param string $plugin_file Plugin file path relative to plugins directory.
 * @return array
 */
function wprai_disable_plugin_folder($plugin_file)
{
	$plugin_file = trim((string) $plugin_file);

	if (empty($plugin_file)) {
		return [
			'success' => false,
			'message' => __('No plugin provided.', 'wp-rescuemode-ai'),
		];
	}

	if (0 === strpos($plugin_file, 'wp-rescuemode-ai')) {
		return [
			'success' => false,
			'message' => __('Skipping RescueMode itself.', 'wp-rescuemode-ai'),
		];
	}

	$parts = explode('/', $plugin_file);
	$slug = $parts[0];

	if (empty($slug)) {
		return [
			'success' => false,
			'message' => __('Cannot determine plugin folder.', 'wp-rescuemode-ai'),
		];
	}

	$source = WP_PLUGIN_DIR . '/' . $slug;
	$target = $source . '.disabled-wpra';

	if (!is_dir($source)) {
		return [
			'success' => false,
			'message' => __('Plugin folder not found.', 'wp-rescuemode-ai'),
		];
	}

	if (file_exists($target)) {
		return [
			'success' => false,
			'message' => __('Folder already disabled.', 'wp-rescuemode-ai'),
		];
	}

	if (!is_writable(dirname($source))) {
		return [
			'success' => false,
			'message' => __('Folder is not writable.', 'wp-rescuemode-ai'),
		];
	}

	$renamed = @rename($source, $target); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

	if (!$renamed) {
		return [
			'success' => false,
			'message' => __('Failed to rename plugin folder.', 'wp-rescuemode-ai'),
		];
	}

	return [
		'success' => true,
		'message' => sprintf(
			/* translators: %s plugin slug */
			__('Renamed %s to .disabled-wpra', 'wp-rescuemode-ai'),
			$slug
		),
		'slug' => $slug,
	];
}
