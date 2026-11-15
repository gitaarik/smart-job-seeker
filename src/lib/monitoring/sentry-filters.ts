/**
 * Shared Sentry beforeSend filter logic.
 *
 * Drops SvelteKit framework-level 4xx errors that are just bot/scanner noise,
 * not application bugs. These were swamping GlitchTip with thousands of events
 * for paths like /.env, /wp-admin/install.php, /.git/config, etc.
 */

const FRAMEWORK_CLIENT_ERROR_PATTERNS = [
	/^Not found: /,
	/^POST method not allowed\./,
	// A path whose percent-encoding is not UTF-8 (`/fonts/NotoSans/.%FA`), which
	// SvelteKit answers 400. No link of ours produces one; each garbled path
	// became its own issue (seven in one day on dev).
	/^Failed to decode URI: /
];

export function isFrameworkClientError(value: string | undefined): boolean {
	if (!value) return false;
	return FRAMEWORK_CLIENT_ERROR_PATTERNS.some((re) => re.test(value));
}
