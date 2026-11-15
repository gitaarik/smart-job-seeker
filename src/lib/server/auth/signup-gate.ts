/**
 * The gate in front of `/sign-up/email`.
 *
 * Turnstile and the registration flag gate the **endpoint**, not the page: a
 * form that checks a token and then calls `/sign-up/email` itself protects
 * nothing, because the caller can skip the form. So everything arriving over
 * HTTP passes through here.
 *
 * It lives in its own module rather than inline in `better-auth.ts` because the
 * branch below is a security boundary, and pinning a security boundary should
 * not require standing up an auth instance and a database.
 */

import { APIError } from 'better-auth/api';
import { verifyTurnstileToken } from '$lib/server/auth/turnstile';
import { autoApproveSignups, registrationOpen } from '$lib/server/auth/registration';
import { isDisposableEmail } from '$lib/server/auth/disposable-email';
import { termsVersion } from '$lib/server/legal/texts';

const TERMS_MESSAGE =
	'Please accept the terms of service and privacy policy. If you already did, reload the page: they have changed since it loaded.';

const DISPOSABLE_MESSAGE =
	"Please use an address you'll keep: disposable email addresses can't be used here.";

/**
 * The slice of better-call's endpoint context this needs. Structural on
 * purpose — the real context carries ~20 more fields, and naming the few that
 * matter is what lets a test construct one honestly.
 */
export interface SignupGateContext {
	/**
	 * Present for every HTTP request (better-call populates it from the
	 * router), absent for in-process `auth.api.*` calls. See `guardSignup`.
	 */
	request?: Request;
	headers?: Headers | null;
	/** The parsed JSON body; `email` on a signup, `newEmail` on a change. */
	body?: { email?: unknown; newEmail?: unknown } | null;
}

/**
 * Refuse a signup that should not happen. Returns silently when it should.
 *
 * Called from `hooks.before` for `/sign-up/email` only.
 */
export async function guardSignup(ctx: SignupGateContext): Promise<void> {
	// Both gates below exist to stop *strangers* registering. Our own
	// server-side code mints accounts through this same endpoint — the
	// demo-template account and each demo user (`$lib/server/demo`) — and it was
	// already authorized before it got here: an admin session, or a valid
	// unexpired invite link. Gating those is not defence, it just breaks the
	// feature, which is exactly what it did between v0.19.0 and this fix: with
	// registration closed, admin "Set as template" answered `Registration is
	// currently closed.` and opening a demo link died in provisioning.
	//
	// `ctx.request` is the discriminator because it cannot be forged in the
	// direction that matters. better-call populates it from the router, so every
	// HTTP request has one; `auth.api.signUpEmail({ body })` invoked in-process
	// has none. There is no way to reach this endpoint over the wire *without* a
	// request object, so an attacker cannot dress up as internal — the worst
	// they can do is arrive as what they already are and hit both checks below.
	//
	// The corollary is a real constraint: anything in-process that calls
	// `signUpEmail` is trusted to have done its own authorization first.
	if (!ctx.request) return;

	// Closing the /signup *route* only hides the form; this is what actually
	// refuses a registration, and it is the check that matters because anything
	// can POST here directly.
	if (!registrationOpen()) {
		throw new APIError('FORBIDDEN', {
			message: 'Registration is currently closed.'
		});
	}

	// The form sends the terms version it showed, as a header for the same
	// reason as the Turnstile token below. Anything but the current one is
	// refused, so an account cannot start without having agreed to the terms
	// that apply, and `signupTermsFields` can record exactly what was agreed
	// to. An instance that publishes no terms asks for none (legal/texts.ts).
	const terms = termsVersion();
	if (terms && ctx.headers?.get('x-terms-version') !== terms) {
		throw new APIError('BAD_REQUEST', { message: TERMS_MESSAGE });
	}

	// Before Turnstile, since it costs nothing and Turnstile costs a call.
	if (typeof ctx.body?.email === 'string' && isDisposableEmail(ctx.body.email)) {
		throw new APIError('BAD_REQUEST', { message: DISPOSABLE_MESSAGE });
	}
	// The token travels as a header rather than a body field — better-auth
	// validates the signup body against the user model and an unknown property
	// is a 400, and a CAPTCHA nonce has no business being on the user model.
	//
	// Skipped entirely when no secret is configured; see `turnstile.ts` for why
	// that is a deliberate open rather than an oversight.
	const token = ctx.headers?.get('x-turnstile-token');
	const ip = ctx.headers?.get('cf-connecting-ip') || ctx.headers?.get('x-real-ip') || undefined;

	const result = await verifyTurnstileToken(token, ip);
	if (!result.success) {
		console.warn(
			`[auth] Signup rejected by Turnstile: ${(result.errorCodes ?? []).join(', ') || 'no codes'}`
		);
		throw new APIError('BAD_REQUEST', {
			message: 'Captcha verification failed. Please reload the page and try again.'
		});
	}
}

/**
 * Refuse moving an account to a disposable address. Called from `hooks.before`
 * for `/change-email`, so the signup check cannot be stepped around by signing
 * up with a real address and switching afterwards.
 */
export function guardEmailChange(ctx: SignupGateContext): void {
	if (typeof ctx.body?.newEmail === 'string' && isDisposableEmail(ctx.body.newEmail)) {
		throw new APIError('BAD_REQUEST', { message: DISPOSABLE_MESSAGE });
	}
}

/**
 * Whether the account this signup creates starts approved.
 *
 * Only a stranger's signup, over HTTP, and only where the environment says so
 * (`autoApproveSignups`). In-process callers (invites, demo accounts) set
 * `is_approved` themselves straight after creating the user, so they are left
 * as they were. Called from the user-create database hook.
 */
export function approvesOnSignup(ctx: { path?: string; request?: Request } | null): boolean {
	if (!ctx?.request || ctx.path !== '/sign-up/email') return false;
	return autoApproveSignups();
}

/**
 * The terms columns a new account starts with: the version `guardSignup`
 * already held to the current one, stamped now. Empty for in-process
 * callers, which never saw a form; an invite or a demo account records
 * nothing rather than an acceptance nobody gave. Called from the user-create
 * database hook.
 */
export function signupTermsFields(
	ctx: { path?: string; request?: Request; headers?: Headers | null } | null
): { terms_version: string; terms_accepted_at: Date } | Record<string, never> {
	if (!ctx?.request || ctx.path !== '/sign-up/email') return {};
	const terms = termsVersion();
	if (!terms || ctx.headers?.get('x-terms-version') !== terms) return {};
	return { terms_version: terms, terms_accepted_at: new Date() };
}
