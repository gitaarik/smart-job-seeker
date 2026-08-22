/**
 * Cloudflare Turnstile verification.
 *
 * Extracted from `/api/verify-turnstile` (which was the only caller, and which
 * only ever told the *client* whether a token was good) so the same check can
 * run where it actually protects something: in front of registration.
 *
 * The distinction matters. A page that verifies a token and then calls the
 * signup endpoint itself has not been protected — an attacker skips the page.
 * The gate has to sit on the endpoint, which is what `hooks.before` in
 * `better-auth.ts` does with this.
 */

import { getEnv } from '$lib/tools/get-env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * The public site key. Safe to ship to the browser by design — it is the
 * secret, not this, that proves a token was checked.
 *
 * Defaults to the key the contact-info widget has always used, so nothing
 * needs configuring to keep working; set `SJS_TURNSTILE_SITE_KEY` when an
 * environment has its own pair.
 */
export function turnstileSiteKey(): string {
	return getEnv('SJS_TURNSTILE_SITE_KEY', '0x4AAAAAABkW4tr8bO8w8Vi8') as string;
}

/**
 * Whether Turnstile is configured at all.
 *
 * A self-hosted install has no Cloudflare account, and refusing every signup
 * on a deployment that never asked for a CAPTCHA would be a worse failure than
 * the one this prevents. So verification is skipped — loudly — when no secret
 * is set, and enforced whenever one is. All three hosted environments set it.
 */
export function turnstileConfigured(): boolean {
	return !!getEnv('SJS_TURNSTILE_SECRET_KEY', '');
}

export interface TurnstileResult {
	success: boolean;
	/** Cloudflare's own codes, for logging. Never shown to the visitor. */
	errorCodes?: string[];
	challengeTs?: string;
	hostname?: string;
}

/**
 * Check one token with Cloudflare.
 *
 * A network failure returns `success: false` rather than throwing: the caller
 * is a gate, and a gate that throws on an upstream hiccup turns Cloudflare
 * being slow into "nobody can register".
 */
export async function verifyTurnstileToken(
	token: string | null | undefined,
	remoteIp?: string | null
): Promise<TurnstileResult> {
	if (!turnstileConfigured()) {
		console.warn('[turnstile] No SJS_TURNSTILE_SECRET_KEY set — skipping verification');
		return { success: true };
	}
	if (!token) return { success: false, errorCodes: ['missing-input-response'] };

	const body = new URLSearchParams({
		secret: getEnv('SJS_TURNSTILE_SECRET_KEY') as string,
		response: token
	});
	if (remoteIp) body.set('remoteip', remoteIp);

	try {
		const res = await fetch(VERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body
		});
		const data = await res.json();
		return data.success
			? { success: true, challengeTs: data.challenge_ts, hostname: data.hostname }
			: { success: false, errorCodes: data['error-codes'] ?? [] };
	} catch (err) {
		console.error('[turnstile] Verification request failed:', err);
		return { success: false, errorCodes: ['internal-error'] };
	}
}
