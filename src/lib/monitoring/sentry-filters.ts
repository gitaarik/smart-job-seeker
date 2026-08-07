/**
 * Shared Sentry beforeSend filter logic.
 *
 * Drops SvelteKit framework-level 4xx errors that are just bot/scanner noise,
 * not application bugs. These were swamping GlitchTip with thousands of events
 * for paths like /.env, /wp-admin/install.php, /.git/config, etc.
 */

const FRAMEWORK_CLIENT_ERROR_PATTERNS = [/^Not found: /, /^POST method not allowed\./];

export function isFrameworkClientError(value: string | undefined): boolean {
	if (!value) return false;
	return FRAMEWORK_CLIENT_ERROR_PATTERNS.some((re) => re.test(value));
}
