/**
 * The profile limit as a form-action refusal.
 *
 * Two things matter: a refusal from the billing guard reaches the page as the
 * `form.error` every creation form already renders (not as the error page a
 * thrown 403 would show), and anything that is not a refusal still throws —
 * a database error must not read as "you have too many profiles".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { error } from '@sveltejs/kit';

const mockRequire = vi.fn();
vi.mock('$lib/server/billing/require-profile-quota', () => ({
	requireProfileQuota: (...a: unknown[]) => mockRequire(...a)
}));

import { profileQuotaFailure } from '../quota';

beforeEach(() => {
	mockRequire.mockReset();
});

describe('profileQuotaFailure', () => {
	it('asks the guard about exactly one new profile for this user', async () => {
		mockRequire.mockResolvedValue(undefined);

		await profileQuotaFailure('user-1');

		expect(mockRequire).toHaveBeenCalledWith('user-1', 1);
	});

	it('returns null when the plan has room', async () => {
		mockRequire.mockResolvedValue(undefined);

		expect(await profileQuotaFailure('user-1')).toBeNull();
	});

	it("turns the guard's 403 into a fail() carrying its message", async () => {
		mockRequire.mockImplementation(async () => {
			error(403, { message: 'Profile limit reached (2 of 2 profiles used).' });
		});

		const r = await profileQuotaFailure('user-1');

		expect(r?.status).toBe(403);
		expect(r?.data).toEqual({ error: 'Profile limit reached (2 of 2 profiles used).' });
	});

	it('rethrows anything that is not a refusal', async () => {
		mockRequire.mockRejectedValue(new Error('connection terminated'));

		await expect(profileQuotaFailure('user-1')).rejects.toThrow('connection terminated');
	});
});
