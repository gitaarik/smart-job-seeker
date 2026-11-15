/**
 * The gate in front of `/sign-up/email`.
 *
 * The branch worth pinning is the first one: our own server-side code mints
 * accounts through this endpoint (the demo-template account, every demo user),
 * and gating those broke the demo feature outright for four releases. The
 * exemption is keyed on `ctx.request` being absent, which only an in-process
 * caller can be — so the tests below assert both halves, that internal calls
 * pass *without consulting either gate*, and that an HTTP request still meets
 * both of them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth/api';

const registrationOpen = vi.hoisted(() => vi.fn());
const autoApproveSignups = vi.hoisted(() => vi.fn());
const verifyTurnstileToken = vi.hoisted(() => vi.fn());
const termsVersion = vi.hoisted(() => vi.fn());
const TERMS_VERSION = '2026-11-13';

vi.mock('$lib/server/auth/registration', () => ({ autoApproveSignups, registrationOpen }));
vi.mock('$lib/server/auth/turnstile', () => ({ verifyTurnstileToken }));
vi.mock('$lib/server/legal/texts', () => ({ termsVersion }));

const { approvesOnSignup, guardEmailChange, guardSignup, signupTermsFields } =
	await import('../signup-gate');

/**
 * A request-bearing context, as the router builds one. It carries the
 * current terms version unless a test says otherwise, as the form does.
 */
function fromHttp(headers: Record<string, string> = {}, body: { email?: string } = {}) {
	return {
		request: new Request('https://example.test/api/auth/sign-up/email', { method: 'POST' }),
		headers: new Headers({ 'x-terms-version': TERMS_VERSION, ...headers }),
		body
	};
}

beforeEach(() => {
	registrationOpen.mockReturnValue(true);
	verifyTurnstileToken.mockResolvedValue({ success: true });
	termsVersion.mockReturnValue(TERMS_VERSION);
});

afterEach(() => vi.clearAllMocks());

describe('guardSignup', () => {
	describe('in-process callers', () => {
		it('is exempt when there is no request, even with registration closed', async () => {
			registrationOpen.mockReturnValue(false);
			await expect(guardSignup({})).resolves.toBeUndefined();
		});

		it('consults neither gate', async () => {
			registrationOpen.mockReturnValue(false);
			await guardSignup({});
			expect(registrationOpen).not.toHaveBeenCalled();
			expect(verifyTurnstileToken).not.toHaveBeenCalled();
		});

		it('stays exempt when headers are present but a request is not', async () => {
			// `auth.api.signUpEmail` accepts a `headers` option without becoming an
			// HTTP call — the request object is the discriminator, not the headers.
			registrationOpen.mockReturnValue(false);
			await expect(guardSignup({ headers: new Headers() })).resolves.toBeUndefined();
		});
	});

	describe('over HTTP', () => {
		it('refuses when registration is closed', async () => {
			registrationOpen.mockReturnValue(false);
			await expect(guardSignup(fromHttp())).rejects.toThrow(APIError);
			await expect(guardSignup(fromHttp())).rejects.toThrow('Registration is currently closed.');
		});

		it('checks registration before spending a Turnstile call', async () => {
			registrationOpen.mockReturnValue(false);
			await expect(guardSignup(fromHttp())).rejects.toThrow(APIError);
			expect(verifyTurnstileToken).not.toHaveBeenCalled();
		});

		it('refuses when Turnstile does not verify', async () => {
			verifyTurnstileToken.mockResolvedValue({ success: false, errorCodes: ['bad-request'] });
			await expect(guardSignup(fromHttp())).rejects.toThrow('Captcha verification failed');
		});

		it('passes when registration is open and Turnstile verifies', async () => {
			await expect(guardSignup(fromHttp())).resolves.toBeUndefined();
		});

		it('reads the token from the header, not the body', async () => {
			await guardSignup(fromHttp({ 'x-turnstile-token': 'tok' }));
			expect(verifyTurnstileToken).toHaveBeenCalledWith('tok', undefined);
		});

		it('prefers cf-connecting-ip over x-real-ip', async () => {
			await guardSignup(
				fromHttp({
					'x-turnstile-token': 'tok',
					'cf-connecting-ip': '1.1.1.1',
					'x-real-ip': '2.2.2.2'
				})
			);
			expect(verifyTurnstileToken).toHaveBeenCalledWith('tok', '1.1.1.1');
		});

		it('falls back to x-real-ip', async () => {
			await guardSignup(fromHttp({ 'x-turnstile-token': 'tok', 'x-real-ip': '2.2.2.2' }));
			expect(verifyTurnstileToken).toHaveBeenCalledWith('tok', '2.2.2.2');
		});
	});

	describe('terms', () => {
		it('refuses a signup that did not accept them, before spending a Turnstile call', async () => {
			const ctx = fromHttp();
			ctx.headers.delete('x-terms-version');
			await expect(guardSignup(ctx)).rejects.toThrow('accept the terms of service');
			expect(verifyTurnstileToken).not.toHaveBeenCalled();
		});

		it('refuses an acceptance of an older version', async () => {
			await expect(guardSignup(fromHttp({ 'x-terms-version': '2000-01-01' }))).rejects.toThrow(
				APIError
			);
		});

		it('does not ask in-process callers', async () => {
			await expect(guardSignup({ headers: new Headers() })).resolves.toBeUndefined();
		});

		it('asks nothing on an instance that publishes no terms', async () => {
			termsVersion.mockReturnValue(null);
			const ctx = fromHttp();
			ctx.headers.delete('x-terms-version');
			await expect(guardSignup(ctx)).resolves.toBeUndefined();
		});
	});

	describe('disposable addresses', () => {
		it('refuses one before spending a Turnstile call', async () => {
			await expect(guardSignup(fromHttp({}, { email: 'x@mailinator.com' }))).rejects.toThrow(
				'disposable email addresses'
			);
			expect(verifyTurnstileToken).not.toHaveBeenCalled();
		});

		it('refuses a subdomain of a listed service, in any case', async () => {
			await expect(guardSignup(fromHttp({}, { email: 'x@Inbox.MAILINATOR.com' }))).rejects.toThrow(
				APIError
			);
		});

		it('lets an ordinary address through', async () => {
			await expect(
				guardSignup(fromHttp({}, { email: 'someone@posteo.net' }))
			).resolves.toBeUndefined();
		});

		it('leaves in-process callers alone', async () => {
			await expect(guardSignup({ body: { email: 'x@mailinator.com' } })).resolves.toBeUndefined();
		});

		it('refuses an email change to one', () => {
			expect(() => guardEmailChange({ body: { newEmail: 'x@mailinator.com' } })).toThrow(APIError);
			expect(() => guardEmailChange({ body: { newEmail: 'x@posteo.net' } })).not.toThrow();
		});
	});
});

describe('approvesOnSignup', () => {
	const signup = { path: '/sign-up/email', request: new Request('https://example.test') };

	it('approves a signup over HTTP when the setting is auto', () => {
		autoApproveSignups.mockReturnValue(true);
		expect(approvesOnSignup(signup)).toBe(true);
	});

	it('leaves it waiting when the setting is manual', () => {
		autoApproveSignups.mockReturnValue(false);
		expect(approvesOnSignup(signup)).toBe(false);
	});

	it('never approves an in-process create (invites, demo accounts)', () => {
		autoApproveSignups.mockReturnValue(true);
		expect(approvesOnSignup({ path: '/sign-up/email' })).toBe(false);
		expect(approvesOnSignup(null)).toBe(false);
	});

	it('never approves a user created by another endpoint', () => {
		autoApproveSignups.mockReturnValue(true);
		expect(approvesOnSignup({ ...signup, path: '/sign-in/social' })).toBe(false);
	});
});

describe('signupTermsFields', () => {
	const signup = (version?: string) => ({
		path: '/sign-up/email',
		request: new Request('https://example.test'),
		headers: new Headers(version ? { 'x-terms-version': version } : {})
	});

	it('records the current version on a signup over HTTP', () => {
		const fields = signupTermsFields(signup(TERMS_VERSION));
		expect(fields).toMatchObject({ terms_version: TERMS_VERSION });
		expect('terms_accepted_at' in fields && fields.terms_accepted_at).toBeInstanceOf(Date);
	});

	it('records nothing for an in-process create (invites, demo accounts)', () => {
		expect(
			signupTermsFields({ path: '/sign-up/email', headers: signup(TERMS_VERSION).headers })
		).toEqual({});
		expect(signupTermsFields(null)).toEqual({});
	});

	it('records nothing on an instance that publishes no terms', () => {
		termsVersion.mockReturnValue(null);
		expect(signupTermsFields(signup(TERMS_VERSION))).toEqual({});
	});

	it('records nothing for a version the gate would have refused', () => {
		expect(signupTermsFields(signup('2000-01-01'))).toEqual({});
		expect(signupTermsFields(signup())).toEqual({});
	});
});
