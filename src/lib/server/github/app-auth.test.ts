import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';

// A throwaway keypair: the JWT has to be verifiable by GitHub's public half, so
// the test verifies it the same way rather than asserting on the string.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' }
});

const h = vi.hoisted(() => ({
	config: { githubAppId: '', githubAppSlug: '', githubAppPrivateKey: '', githubToken: '' }
}));
vi.mock('$lib/server/config', () => ({ config: h.config }));
vi.mock('$lib/server/db', () => ({ dbDirect: {} }));

import { appInstallUrl, createAppJwt, installationToken, isGitHubAppConfigured } from './app-auth';

const NOW_S = 1_760_000_000;

beforeEach(() => {
	h.config.githubAppId = '12345';
	h.config.githubAppSlug = 'smart-job-seeker';
	h.config.githubAppPrivateKey = Buffer.from(privateKey).toString('base64');
});
afterEach(() => vi.unstubAllGlobals());

describe('configuration', () => {
	it('reports itself unconfigured until both the id and the key are set', () => {
		expect(isGitHubAppConfigured()).toBe(true);
		h.config.githubAppPrivateKey = '';
		expect(isGitHubAppConfigured()).toBe(false);
		h.config.githubAppPrivateKey = 'x';
		h.config.githubAppId = '';
		expect(isGitHubAppConfigured()).toBe(false);
	});

	it('url-encodes the state into the install link', () => {
		const url = appInstallUrl('a b/c');
		expect(url).toBe('https://github.com/apps/smart-job-seeker/installations/new?state=a%20b%2Fc');
		h.config.githubAppSlug = '';
		expect(appInstallUrl('x')).toBeNull();
	});
});

describe('createAppJwt', () => {
	const decode = (jwt: string, part: number) =>
		JSON.parse(Buffer.from(jwt.split('.')[part], 'base64url').toString('utf8'));

	it('signs something GitHub can verify with the public half', () => {
		const jwt = createAppJwt(NOW_S);
		const [header, payload, signature] = jwt.split('.');
		const verifier = createVerify('RSA-SHA256');
		verifier.update(`${header}.${payload}`);
		verifier.end();
		expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
		expect(decode(jwt, 0)).toEqual({ alg: 'RS256', typ: 'JWT' });
	});

	it('backdates iat and stays inside the ten-minute cap', () => {
		// GitHub rejects a token issued in its future, which a server a few seconds
		// fast produces, and rejects an exp more than 10 minutes out.
		const claims = decode(createAppJwt(NOW_S), 1);
		expect(claims.iat).toBe(NOW_S - 60);
		expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
		expect(claims.iss).toBe('12345');
	});

	it('accepts a pasted PEM as well as base64', () => {
		h.config.githubAppPrivateKey = privateKey;
		expect(() => createAppJwt(NOW_S)).not.toThrow();
	});
});

describe('installationToken', () => {
	const NOW_MS = NOW_S * 1000;
	const okResponse = (token: string, expiresAt: string) => ({
		ok: true,
		status: 201,
		json: async () => ({ token, expires_at: expiresAt })
	});

	it('mints once and reuses the token while it is valid', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(okResponse('ghs_first', new Date(NOW_MS + 3_600_000).toISOString()));
		vi.stubGlobal('fetch', fetchMock);

		expect(await installationToken(41, NOW_MS)).toBe('ghs_first');
		expect(await installationToken(41, NOW_MS + 60_000)).toBe('ghs_first');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toContain('/app/installations/41/access_tokens');
	});

	it('re-mints a minute before expiry rather than at it', async () => {
		// A token that dies mid-request surfaces as a confusing 401, not as expiry.
		const fetchMock = vi
			.fn()
			.mockResolvedValue(okResponse('ghs_second', new Date(NOW_MS + 3_600_000).toISOString()));
		vi.stubGlobal('fetch', fetchMock);
		await installationToken(42, NOW_MS);
		await installationToken(42, NOW_MS + 3_600_000 - 30_000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('returns null for a revoked installation instead of throwing', async () => {
		// Uninstalling the app 404s here. The caller falls back to unauthenticated
		// access, which still serves public repositories.
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		expect(await installationToken(43, NOW_MS)).toBeNull();
	});

	it('does nothing at all when the app is not configured', async () => {
		h.config.githubAppId = '';
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		expect(await installationToken(44, NOW_MS)).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
