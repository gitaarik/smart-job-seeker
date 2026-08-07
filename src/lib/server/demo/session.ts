/**
 * Server-side auto-login for demo links.
 *
 * Signs the demo user in via Better Auth's own email/password endpoint and
 * forwards the resulting session cookies onto the current SvelteKit response.
 * Reusing Better Auth's sign-in (rather than hand-crafting a session row) keeps
 * cookie signing + session shape identical to a normal login.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { parse as parseSetCookie } from 'set-cookie-parser';
import { auth } from '$lib/server/auth/better-auth';
import type { DemoCredentials } from './provision';

/** Sign the demo user in and copy Better Auth's session cookies onto `event`. */
export async function establishDemoSession(
	event: RequestEvent,
	creds: DemoCredentials
): Promise<void> {
	const response = await auth.api.signInEmail({
		body: { email: creds.email, password: creds.password },
		asResponse: true
	});

	const setCookies = response.headers.getSetCookie();
	if (setCookies.length === 0) {
		throw new Error('Demo auto-login produced no session cookie');
	}

	for (const parsed of parseSetCookie(setCookies)) {
		event.cookies.set(parsed.name, parsed.value, {
			// set-cookie-parser gives lowercased attribute names; map to SvelteKit's.
			path: parsed.path ?? '/',
			httpOnly: parsed.httpOnly ?? true,
			secure: parsed.secure ?? false,
			sameSite: (parsed.sameSite?.toLowerCase() as 'lax' | 'strict' | 'none') ?? 'lax',
			maxAge: parsed.maxAge,
			expires: parsed.expires
		});
	}
}
