=== WP RescueMode AI ===
Contributors: wp-rescue-suite
Tags: rescue mode, ai, troubleshooting, debug log, conflict scanner
Requires at least: 6.2
Tested up to: 6.4
Requires PHP: 8.0
Stable tag: 0.1.0
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

AI-powered rescue mode for WordPress. Provides a protected URL to diagnose WSOD/critical errors, generate developer-ready emails, and (soon) an admin conflict scanner.

== Description ==

WP RescueMode AI is part of the “AI does it for you” suite. It keeps a protected rescue URL ready for when your site breaks, and will grow into a full conflict scanner inside wp-admin.

== Features (early preview) ==

* Rescue URL with token so you can reach a minimal UI even when normal plugins break (route `/wp-rescue?token=...`).
* Admin dashboard that shows/regenerates the rescue URL, stores an OpenAI key, tests diagnostics, and previews conflict scanning.
* REST endpoints: `/wp-rescuemode/v1/diagnose` (reads debug.log tail, surfaces suspected plugins, optional safe disable, AI summary), `/wp-rescuemode/v1/generate-email` (developer email draft via AI or fallback), and `/wp-rescuemode/v1/conflict-scan` (dry-run state machine for now).
* External rescue page and admin dashboard both offer AI summaries and email generator buttons with copy-to-clipboard UX.
* Vite/Tailwind build pipeline with plain JS controllers for admin/rescue screens (npm run build).

== Installation ==

1. Upload the plugin to `wp-content/plugins/wp-rescuemode-ai`.
2. Activate the plugin from **Plugins**.
3. Optional: copy `mu-loader/wp-rescue-suite-loader.php` to `wp-content/mu-plugins/` so the rescue loader runs even if normal plugins fail.

== Roadmap ==

* Full rescue UI with debug log tail, AI-driven plugin deactivation, and email generator.
* Conflict Scanner flow with animated timeline and detailed summaries.
* Settings for OpenAI keys, logging retention, and scan modes.
