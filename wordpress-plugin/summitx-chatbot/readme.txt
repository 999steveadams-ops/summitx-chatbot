=== SummitX ChatBot ===
Contributors: summitx
Tags: chatbot, ai, chat, support, gemini, assistant
Requires at least: 5.5
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed your SummitX AI chat widget on any WordPress site from a simple settings page — no code required.

== Description ==

SummitX ChatBot drops your branded, AI-powered chat widget onto the front end of your
WordPress site. You manage the assistant (its prompt, brand color, and replies) in your
SummitX admin dashboard; this plugin just connects your site to it.

The plugin stores no API keys and sends no data anywhere except loading the widget script
from the SummitX app URL you configure. All chat processing happens on your SummitX app.

== Installation ==

1. In your SummitX admin dashboard, open the client you want to embed and copy its
   **Client (Tenant) ID**. Note your app's public **App URL** (for example
   https://chat.youragency.com).
2. In WordPress, go to **Plugins → Add New → Upload Plugin** and upload
   `summitx-chatbot.zip`, then click **Activate**.
3. Go to **Settings → SummitX ChatBot**.
4. Enter your **App URL** and **Client (Tenant) ID**, make sure **Enable widget** is
   checked, and click **Save Changes**.
5. Visit the front end of your site — the chat bubble appears in the bottom-right corner.

== Frequently Asked Questions ==

= The bubble doesn't appear. What should I check? =
* Make sure both App URL and Client (Tenant) ID are filled in and "Enable widget" is on.
* Your SummitX app must be reachable from your visitors' browsers. A local address like
  http://localhost:3000 only works if WordPress is running on the same machine — for a
  live site, deploy the SummitX app to a public URL (e.g. Vercel) and use that URL here.
* Some caching or security plugins strip injected scripts; clear your cache after saving.

= Does this plugin store my API keys? =
No. Gemini and Supabase keys live only in your SummitX app's server environment. This
plugin only knows your public App URL and the Client (Tenant) ID.

== Changelog ==

= 1.0.0 =
* Initial release: settings page + front-end widget injection.
