/**
 * Who the app pages send to /accept-terms. The cases worth pinning are the
 * ones that must not be asked: an instance without terms, an admin looking at
 * someone's account, and a demo copy.
 */
import { describe, expect, it, vi } from 'vitest';

let current: string | null = '2026-11-13';
vi.mock('../texts', () => ({ termsVersion: () => current }));

const { mustAcceptTerms, safeReturnPath } = await import('../gate');

describe('mustAcceptTerms', () => {
	it('asks an account that never accepted, and one on an older version', () => {
		current = '2026-11-13';
		expect(mustAcceptTerms({ terms_version: null }, false)).toBe(true);
		expect(mustAcceptTerms({}, false)).toBe(true);
		expect(mustAcceptTerms({ terms_version: '2026-01-01' }, false)).toBe(true);
	});

	it('lets the current version through', () => {
		current = '2026-11-13';
		expect(mustAcceptTerms({ terms_version: '2026-11-13' }, false)).toBe(false);
	});

	it('asks nobody when the instance has no terms', () => {
		current = null;
		expect(mustAcceptTerms({ terms_version: null }, false)).toBe(false);
	});

	it('does not ask an impersonating admin or a demo copy', () => {
		current = '2026-11-13';
		expect(mustAcceptTerms({ terms_version: null }, true)).toBe(false);
		expect(mustAcceptTerms({ terms_version: null, is_demo: true }, false)).toBe(false);
	});
});

describe('safeReturnPath', () => {
	it('keeps a path on this site and drops anything else', () => {
		expect(safeReturnPath('/jobs?x=1')).toBe('/jobs?x=1');
		expect(safeReturnPath('//evil.example')).toBe('/home');
		expect(safeReturnPath('https://evil.example')).toBe('/home');
		expect(safeReturnPath(null)).toBe('/home');
	});
});
