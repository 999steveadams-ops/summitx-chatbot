<?php
/**
 * Plugin Name:       SummitX ChatBot
 * Description:       Embed your SummitX AI chat widget on this WordPress site. Configure it under Settings → SummitX ChatBot — no code required.
 * Version:           1.0.0
 * Requires at least: 5.5
 * Requires PHP:      7.2
 * Author:            SummitX
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       summitx-chatbot
 *
 * How it works: this plugin simply outputs the same one-line loader
 * ( <script src="APP_URL/embed.js?id=TENANT_ID" async></script> ) on the
 * front end, using values you enter on the settings page. The chat itself is
 * served entirely by your SummitX app — this plugin holds no secrets.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Prevent direct access.
}

define( 'SUMMITX_CHATBOT_OPTION', 'summitx_chatbot_settings' );

/**
 * Default settings.
 *
 * @return array
 */
function summitx_chatbot_defaults() {
	return array(
		'app_url'   => '',
		'tenant_id' => '',
		'enabled'   => '1',
	);
}

/**
 * Read merged settings.
 *
 * @return array
 */
function summitx_chatbot_get_settings() {
	$saved = get_option( SUMMITX_CHATBOT_OPTION, array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), summitx_chatbot_defaults() );
}

/**
 * Build the loader script URL from settings. Empty string if not configured.
 *
 * @param array $s Settings.
 * @return string
 */
function summitx_chatbot_script_src( $s ) {
	if ( empty( $s['app_url'] ) || empty( $s['tenant_id'] ) ) {
		return '';
	}
	return trailingslashit( $s['app_url'] ) . 'embed.js?id=' . rawurlencode( $s['tenant_id'] );
}

/* -------------------------------------------------------------------------
 * Admin settings page
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', 'summitx_chatbot_admin_menu' );
function summitx_chatbot_admin_menu() {
	add_options_page(
		__( 'SummitX ChatBot', 'summitx-chatbot' ),
		__( 'SummitX ChatBot', 'summitx-chatbot' ),
		'manage_options',
		'summitx-chatbot',
		'summitx_chatbot_settings_page'
	);
}

add_action( 'admin_init', 'summitx_chatbot_register_settings' );
function summitx_chatbot_register_settings() {
	register_setting(
		'summitx_chatbot_group',
		SUMMITX_CHATBOT_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'summitx_chatbot_sanitize',
			'default'           => summitx_chatbot_defaults(),
		)
	);
}

/**
 * Sanitize + validate settings before save.
 *
 * @param array $input Raw input.
 * @return array
 */
function summitx_chatbot_sanitize( $input ) {
	$out = summitx_chatbot_defaults();

	if ( isset( $input['app_url'] ) ) {
		$out['app_url'] = esc_url_raw( trim( (string) $input['app_url'] ) );
	}
	if ( isset( $input['tenant_id'] ) ) {
		$out['tenant_id'] = sanitize_text_field( (string) $input['tenant_id'] );
	}
	$out['enabled'] = ( ! empty( $input['enabled'] ) ) ? '1' : '0';

	return $out;
}

function summitx_chatbot_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$s   = summitx_chatbot_get_settings();
	$src = summitx_chatbot_script_src( $s );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'SummitX ChatBot', 'summitx-chatbot' ); ?></h1>
		<p style="max-width:640px;">
			<?php esc_html_e( 'Enter your SummitX app URL and the client (tenant) ID from your admin dashboard. Once saved and enabled, the branded AI chat bubble appears on the front end of this site.', 'summitx-chatbot' ); ?>
		</p>

		<form method="post" action="options.php">
			<?php settings_fields( 'summitx_chatbot_group' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">
						<label for="summitx_app_url"><?php esc_html_e( 'App URL', 'summitx-chatbot' ); ?></label>
					</th>
					<td>
						<input name="<?php echo esc_attr( SUMMITX_CHATBOT_OPTION ); ?>[app_url]"
							id="summitx_app_url" type="url" class="regular-text"
							placeholder="https://your-app.com"
							value="<?php echo esc_attr( $s['app_url'] ); ?>" />
						<p class="description">
							<?php esc_html_e( 'The public base URL where your SummitX ChatBot app is hosted — no trailing path. Example: https://chat.youragency.com', 'summitx-chatbot' ); ?>
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="summitx_tenant_id"><?php esc_html_e( 'Client (Tenant) ID', 'summitx-chatbot' ); ?></label>
					</th>
					<td>
						<input name="<?php echo esc_attr( SUMMITX_CHATBOT_OPTION ); ?>[tenant_id]"
							id="summitx_tenant_id" type="text" class="regular-text"
							placeholder="3f9a1b2c-…"
							value="<?php echo esc_attr( $s['tenant_id'] ); ?>" />
						<p class="description">
							<?php esc_html_e( 'Copy this from the client card in your SummitX admin dashboard.', 'summitx-chatbot' ); ?>
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Enable widget', 'summitx-chatbot' ); ?></th>
					<td>
						<label>
							<input name="<?php echo esc_attr( SUMMITX_CHATBOT_OPTION ); ?>[enabled]"
								type="checkbox" value="1" <?php checked( $s['enabled'], '1' ); ?> />
							<?php esc_html_e( 'Show the chat widget on the front end of this site', 'summitx-chatbot' ); ?>
						</label>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<?php if ( $src ) : ?>
			<hr />
			<h2><?php esc_html_e( 'Status', 'summitx-chatbot' ); ?></h2>
			<p>
				<?php
				echo esc_html(
					'1' === $s['enabled']
						? '✅ ' . __( 'Widget is active on the front end.', 'summitx-chatbot' )
						: '⏸️ ' . __( 'Widget is configured but currently disabled.', 'summitx-chatbot' )
				);
				?>
			</p>
			<p><?php esc_html_e( 'Loader being injected:', 'summitx-chatbot' ); ?></p>
			<p><code><?php echo esc_html( '<script src="' . $src . '" async></script>' ); ?></code></p>
		<?php else : ?>
			<hr />
			<p><em><?php esc_html_e( 'Enter both an App URL and a Client (Tenant) ID above to activate the widget.', 'summitx-chatbot' ); ?></em></p>
		<?php endif; ?>
	</div>
	<?php
}

/**
 * Add a "Settings" link on the Plugins list row.
 */
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'summitx_chatbot_action_links' );
function summitx_chatbot_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=summitx-chatbot' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'summitx-chatbot' ) . '</a>' );
	return $links;
}

/* -------------------------------------------------------------------------
 * Front-end injection
 * ---------------------------------------------------------------------- */

add_action( 'wp_footer', 'summitx_chatbot_render', 100 );
function summitx_chatbot_render() {
	$s = summitx_chatbot_get_settings();

	if ( '1' !== $s['enabled'] ) {
		return;
	}
	$src = summitx_chatbot_script_src( $s );
	if ( '' === $src ) {
		return;
	}

	printf(
		'<script src="%s" async data-summitx-chatbot="1"></script>' . "\n",
		esc_url( $src )
	);
}
