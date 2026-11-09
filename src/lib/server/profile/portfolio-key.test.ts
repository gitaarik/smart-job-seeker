import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const mockValidate = vi.fn();
vi.mock('$lib/server/auth/token-validation', () => ({
	validateToken: (...a: unknown[]) => mockValidate(...a)
}));

import { givePortfolioKey, portfolioKeyCookie, readPortfolioKey } from './portfolio-key';

/**
 * The key a portfolio link leaves behind. It is checked against the link on
 * every read, so a link that is disabled, expired, deleted or of another
 * format closes the page; and it outlives the link's visit limit, which counts
 * how often the link is opened, not how often the page is read.
 */

function jar(initial: Record<string, string> = {}) {
	const values = { ...initial };
	const set = vi.fn(
		(name: string, value: string, _options: { maxAge?: number; secure?: boolean }) =>
			(values[name] = value)
	);
	const del = vi.fn((name: string) => delete values[name]);
	const cookies = {
		get: (name: string) => values[name],
		set,
		delete: del
	} as unknown as Cookies;
	return { cookies, values, set, del };
}

const HTTPS = new URL('https://dev.example/p/alex/portfolio/cv');

beforeEach(() => vi.clearAllMocks());

describe('readPortfolioKey', () => {
	test('no cookie, no key, and no lookup', async () => {
		const { cookies } = jar();
		expect(await readPortfolioKey(cookies, HTTPS, 1)).toBeNull();
		expect(mockValidate).not.toHaveBeenCalled();
	});

	test('a live portfolio link opens the page, its visit limit aside', async () => {
		mockValidate.mockResolvedValue({
			valid: true,
			tokenId: 3,
			profileVersionId: 50,
			format: 'portfolio'
		});
		const { cookies } = jar({ [portfolioKeyCookie(1)]: 'abc' });
		expect(await readPortfolioKey(cookies, HTTPS, 1)).toEqual({
			token: 'abc',
			tokenId: 3,
			versionId: 50
		});
		expect(mockValidate).toHaveBeenCalledWith('abc', 1, { visitLimit: false });
	});

	test('a link that stopped working takes its key with it', async () => {
		mockValidate.mockResolvedValue({ valid: false, error: 'Access token is no longer valid' });
		const { cookies, del } = jar({ [portfolioKeyCookie(1)]: 'abc' });
		expect(await readPortfolioKey(cookies, HTTPS, 1)).toBeNull();
		expect(del).toHaveBeenCalledWith(portfolioKeyCookie(1), { path: '/', secure: true });
	});

	test('a resume or CV link is no key to the portfolio', async () => {
		mockValidate.mockResolvedValue({ valid: true, tokenId: 3, profileVersionId: 50, format: 'cv' });
		const { cookies } = jar({ [portfolioKeyCookie(1)]: 'abc' });
		expect(await readPortfolioKey(cookies, HTTPS, 1)).toBeNull();
	});

	test("one profile's key is not read for another", async () => {
		const { cookies } = jar({ [portfolioKeyCookie(2)]: 'abc' });
		expect(await readPortfolioKey(cookies, HTTPS, 1)).toBeNull();
		expect(mockValidate).not.toHaveBeenCalled();
	});
});

describe('givePortfolioKey', () => {
	test('an httpOnly cookie on the whole site, for half a year', () => {
		const { cookies, set } = jar();
		givePortfolioKey(cookies, HTTPS, 1, 'abc', null);
		expect(set).toHaveBeenCalledWith(portfolioKeyCookie(1), 'abc', {
			path: '/',
			maxAge: 60 * 60 * 24 * 182,
			httpOnly: true,
			sameSite: 'lax',
			secure: true
		});
	});

	test('no longer than the link itself lasts', () => {
		const { cookies, set } = jar();
		givePortfolioKey(cookies, HTTPS, 1, 'abc', new Date(Date.now() + 3600_000));
		const maxAge = set.mock.lastCall?.[2].maxAge;
		expect(maxAge).toBeGreaterThan(3590);
		expect(maxAge).toBeLessThanOrEqual(3600);
	});

	test('nothing for a link already expired, and not marked secure over plain http', () => {
		const { cookies, set } = jar();
		givePortfolioKey(cookies, HTTPS, 1, 'abc', new Date(Date.now() - 1000));
		expect(set).not.toHaveBeenCalled();

		givePortfolioKey(cookies, new URL('http://app:5173/p/alex/s/abc'), 1, 'abc', null);
		expect(set.mock.lastCall?.[2].secure).toBe(false);
	});
});
