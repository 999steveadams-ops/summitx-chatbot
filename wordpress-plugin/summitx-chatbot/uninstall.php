<?php
/**
 * Fired when the plugin is deleted from WordPress. Removes saved settings.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'summitx_chatbot_settings' );
