import { describe, expect, it } from 'vitest';
import { signInstallState, verifyInstallState } from './app-state';

const NOW = 1_760_000_000_000;

describe('install state', () => {
	it('round-trips the user and return path', () => {
		const state = signInstallState('user-1', '/profile/side-projects/223', NOW);
		expect(verifyInstallState(state, NOW + 1000)).toEqual({
			userId: 'user-1',
			returnTo: '/profile/side-projects/223'
		});
	});

	it('rejects a tampered payload', () => {
		const state = signInstallState('user-1', '/a', NOW);
		const [encoded, signature] = state.split('.');
		const forged = Buffer.from(`${NOW}:attacker:/a`).toString('base64url');
		expect(verifyInstallState(`${forged}.${signature}`, NOW)).toBeNull();
		// And a valid payload with someone else's signature.
		expect(verifyInstallState(`${encoded}.${'x'.repeat(43)}`, NOW)).toBeNull();
	});

	it('expires', () => {
		const state = signInstallState('user-1', '/a', NOW);
		expect(verifyInstallState(state, NOW + 29 * 60 * 1000)).not.toBeNull();
		expect(verifyInstallState(state, NOW + 31 * 60 * 1000)).toBeNull();
	});

	it('refuses to carry an off-site return path', () => {
		// Signed and returned to the browser, an absolute return_to would be an
		// open redirect wearing our own signature.
		for (const hostile of ['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)']) {
			const state = signInstallState('user-1', hostile, NOW);
			expect(verifyInstallState(state, NOW)?.returnTo).toBe('/');
		}
	});

	it('survives a return path containing colons', () => {
		// The payload is colon-delimited, so a path with one must not truncate.
		const state = signInstallState('user-1', '/a:b:c', NOW);
		expect(verifyInstallState(state, NOW)?.returnTo).toBe('/a:b:c');
	});

	it('rejects garbage rather than throwing', () => {
		for (const bad of ['', 'nodot', '...', 'a.b.c']) {
			expect(verifyInstallState(bad, NOW)).toBeNull();
		}
	});
});
