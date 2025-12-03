<?php
/**
 * Simple OpenAI chat client wrapper.
 *
 * @package WP_RescueMode_AI
 */

namespace WPRAI;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI client.
 */
class AI_Client {
	/**
	 * API key.
	 *
	 * @var string
	 */
	private $api_key;

	/**
	 * Constructor.
	 *
	 * @param string $api_key OpenAI API key.
	 */
	public function __construct( $api_key ) {
		$this->api_key = trim( (string) $api_key );
	}

	/**
	 * Whether a key is configured.
	 *
	 * @return bool
	 */
	public function is_configured() {
		return ! empty( $this->api_key );
	}

	/**
	 * Call OpenAI chat completions.
	 *
	 * @param array $messages Chat messages.
	 * @param array $options  Options (model, temperature, max_tokens).
	 * @return array|WP_Error
	 */
	public function chat( $messages, $options = [] ) {
		if ( empty( $this->api_key ) ) {
			return new WP_Error( 'wprai_missing_key', __( 'OpenAI API key not set.', 'wp-rescuemode-ai' ), [ 'status' => 400 ] );
		}

		$endpoint = 'https://api.openai.com/v1/chat/completions';
		$body     = wp_json_encode(
			[
				'model'       => isset( $options['model'] ) ? $options['model'] : 'gpt-4o-mini',
				'messages'    => $messages,
				'temperature' => isset( $options['temperature'] ) ? $options['temperature'] : 0.3,
				'max_tokens'  => isset( $options['max_tokens'] ) ? $options['max_tokens'] : 400,
				'response_format' => $options['response_format'] ?? null,
			]
		);

		$request = wp_remote_post(
			$endpoint,
			[
				'headers' => [
					'Authorization' => 'Bearer ' . $this->api_key,
					'Content-Type'  => 'application/json',
				],
				'body'    => $body,
				'timeout' => 30,
			]
		);

		if ( is_wp_error( $request ) ) {
			return $request;
		}

		$code = wp_remote_retrieve_response_code( $request );
		$data = json_decode( wp_remote_retrieve_body( $request ), true );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error( 'wprai_openai_error', __( 'OpenAI API error.', 'wp-rescuemode-ai' ), [ 'status' => $code, 'response' => $data ] );
		}

		return $data;
	}
}
