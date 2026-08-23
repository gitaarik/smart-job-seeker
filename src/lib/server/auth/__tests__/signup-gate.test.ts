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
const verifyTurnstileToken = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/auth/registration', () => ({ registrationOpen }));
vi.mock('$lib/server/auth/turnstile', () => ({ verifyTurnstileToken }));

const { guardSignup } = await import('../signup-gate');

/** A request-bearing context, as the router builds one. */
function fromHttp(headers: Record<string, string> = {}) {
	return {
		request: new Request('https://example.test/api/auth/sign-up/email', { method: 'POST' }),
		headers: new Headers(headers)
	};
}

beforeEach(() => {
	registrationOpen.mockReturnValue(true);
	verifyTurnstileToken.mockResolvedValue({ success: true });
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
});
