/**
 * The OSS profile-quota stub: a self-hosted install has no plans to enforce.
 *
 * This lives inside billing/ on purpose. The dev container bind-mounts cloud's
 * billing/ over this directory, tests included, so there this file goes away
 * with the stub and cloud's own test checks the real guard. From anywhere
 * else the same import reaches cloud's guard in that container, and the test
 * fails on a file that is not the one it is about.
 */
import { describe, expect, it } from 'vitest';
import { requireProfileQuota } from '../require-profile-quota';

describe('the OSS stub', () => {
	it('never refuses: a self-hosted install has no plan limits', async () => {
		await expect(requireProfileQuota('user-1', 1_000_000)).resolves.toBeUndefined();
	});
});
