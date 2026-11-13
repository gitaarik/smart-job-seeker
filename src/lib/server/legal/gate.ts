/**
 * Whether a signed-in account has to accept the current terms before it can
 * use the app: one that signed up before there were terms, or accepted a
 * version that has since changed. The (app) layout sends it to
 * /accept-terms, which records the acceptance.
 *
 * Only the app pages ask. The API answers as before, so a running search or
 * an open tab is not cut off mid-request when a new version goes live.
 */

import { termsVersion } from './texts';

type GateUser = {
	terms_version?: string | null;
	is_demo?: boolean | null;
};

export function mustAcceptTerms(user: GateUser, impersonating: boolean): boolean {
	const current = termsVersion();
	if (!current) return false;
	// An admin looking at someone else's account is not that person agreeing.
	if (impersonating) return false;
	// A demo link opens a throwaway copy for a look around; asking first
	// would put a legal page in front of the demo.
	if (user.is_demo) return false;
	return user.terms_version !== current;
}

/**
 * A redirect target from the query string, kept on this site. Parsed rather
 * than prefix-checked: browsers read `/\\evil.example` as `//evil.example`.
 */
export function safeReturnPath(raw: string | null): string {
	if (!raw || !raw.startsWith('/')) return '/home';
	if ([...raw].some((c) => c === '\\' || c.charCodeAt(0) < 0x20)) return '/home';
	const base = 'http://localhost';
	const url = new URL(raw, base);
	return url.origin === base ? url.pathname + url.search + url.hash : '/home';
}
