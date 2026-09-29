/**
 * What may cause spend, and the one exemption that must not be tidied away.
 *
 * The guard exists because cutting ACCESS and cutting SPEND turned out to be
 * different things: an expired demo kept being scored for six weeks after the
 * sweep had de-approved it. So the interesting assertions here are not the
 * happy path but the two edges:
 *
 *  - the demo TEMPLATE is never approved and must still be allowed, because
 *    `copyJobMatches` seeds every clone from its matches; blocking it makes
 *    each new mint re-score the whole corpus, which is the bug this came from;
 *  - a missing user is BLOCKED rather than allowed, because this replaces the
 *    matcher's inline orphan guard, and `getBalance` throws a foreign-key
 *    violation on an owner that no longer exists.
 *
 * The idle rule has edges of its own: it applies to background work only, a
 * signup nobody has stamped yet is measured from its creation, and a match
 * digest counts as use.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const findDigestProfile = vi.fn();
/** Columns the query asked for, so the row stays one row. */
let requestedColumns: Record<string, boolean> | undefined;

vi.mock('drizzle-orm', () => ({
	and: (...args: unknown[]) => ({ op: 'and', args }),
	eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b })
}));
vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			users: {
				findFirst: (args: { columns?: Record<string, boolean> }) => {
					requestedColumns = args.columns;
					return findFirst(args);
				}
			},
			profiles: { findFirst: (args: unknown) => findDigestProfile(args) }
		}
	}
}));
vi.mock('$lib/server/db/schema', () => ({
	users: { id: 'users.id' },
	profiles: { user_id: 'profiles.user_id', email_digest_enabled: 'profiles.email_digest_enabled' }
}));

import { describeSpendBlock, getSpendEligibility, IDLE_AFTER_DAYS } from '../spend-eligibility';

const NOW = new Date('2026-09-29T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const APPROVED = {
	is_approved: true,
	is_demo_template: false,
	deletion_requested_at: null,
	last_seen_at: daysAgo(1),
	createdAt: daysAgo(200)
};
const IDLE = { ...APPROVED, last_seen_at: daysAgo(IDLE_AFTER_DAYS + 1) };

beforeEach(() => {
	findFirst.mockReset();
	findDigestProfile.mockReset();
	findDigestProfile.mockResolvedValue(undefined);
	requestedColumns = undefined;
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('getSpendEligibility', () => {
	it('allows an approved account', async () => {
		findFirst.mockResolvedValue(APPROVED);
		expect(await getSpendEligibility('u1')).toEqual({ allowed: true });
	});

	it('blocks an account that is not approved, which is how an expired demo reads', async () => {
		findFirst.mockResolvedValue({ ...APPROVED, is_approved: false });
		expect(await getSpendEligibility('u1')).toEqual({
			allowed: false,
			reason: 'not_approved'
		});
	});

	it('blocks an account with a pending erasure', async () => {
		findFirst.mockResolvedValue({ ...APPROVED, deletion_requested_at: new Date('2026-09-01') });
		expect(await getSpendEligibility('u1')).toEqual({
			allowed: false,
			reason: 'deletion_pending'
		});
	});

	it('blocks a profile whose owner no longer exists', async () => {
		findFirst.mockResolvedValue(undefined);
		expect(await getSpendEligibility('gone')).toEqual({
			allowed: false,
			reason: 'user_missing'
		});
	});

	it('allows the demo template even though it is never approved', async () => {
		findFirst.mockResolvedValue({
			is_approved: false,
			is_demo_template: true,
			deletion_requested_at: null,
			last_seen_at: null,
			createdAt: daysAgo(200)
		});
		expect(await getSpendEligibility('template')).toEqual({ allowed: true });
	});

	it('reads only the columns it needs, not the whole user row', async () => {
		findFirst.mockResolvedValue(APPROVED);
		await getSpendEligibility('u1');
		expect(requestedColumns).toEqual({
			is_approved: true,
			is_demo_template: true,
			deletion_requested_at: true,
			last_seen_at: true,
			createdAt: true
		});
	});

	it('describes every reason it can return', () => {
		for (const reason of ['user_missing', 'not_approved', 'deletion_pending', 'idle'] as const) {
			expect(describeSpendBlock(reason)).toMatch(/\S/);
		}
	});
});

describe('getSpendEligibility for background work', () => {
	it('blocks an account nobody has used for the idle period', async () => {
		findFirst.mockResolvedValue(IDLE);
		expect(await getSpendEligibility('u1', { background: true })).toEqual({
			allowed: false,
			reason: 'idle'
		});
	});

	it('never applies the idle rule to work a person asked for', async () => {
		findFirst.mockResolvedValue(IDLE);
		expect(await getSpendEligibility('u1')).toEqual({ allowed: true });
		expect(findDigestProfile).not.toHaveBeenCalled();
	});

	it('allows an account used within the idle period', async () => {
		findFirst.mockResolvedValue({ ...APPROVED, last_seen_at: daysAgo(IDLE_AFTER_DAYS - 1) });
		expect(await getSpendEligibility('u1', { background: true })).toEqual({ allowed: true });
	});

	it('measures an account never stamped from its creation, so a new signup is not idle', async () => {
		findFirst.mockResolvedValue({ ...APPROVED, last_seen_at: null, createdAt: daysAgo(2) });
		expect(await getSpendEligibility('new', { background: true })).toEqual({ allowed: true });

		findFirst.mockResolvedValue({ ...APPROVED, last_seen_at: null, createdAt: daysAgo(90) });
		expect(await getSpendEligibility('old', { background: true })).toEqual({
			allowed: false,
			reason: 'idle'
		});
	});

	it('does not block an account with no date to measure from', async () => {
		findFirst.mockResolvedValue({ ...APPROVED, last_seen_at: null, createdAt: null });
		expect(await getSpendEligibility('u1', { background: true })).toEqual({ allowed: true });
	});

	it('counts a match digest as use, since the digest is built from the matching', async () => {
		findFirst.mockResolvedValue(IDLE);
		findDigestProfile.mockResolvedValue({ id: 7 });
		expect(await getSpendEligibility('reader', { background: true })).toEqual({ allowed: true });
		expect(findDigestProfile).toHaveBeenCalledWith({
			where: {
				op: 'and',
				args: [
					{ op: 'eq', a: 'profiles.user_id', b: 'reader' },
					{ op: 'eq', a: 'profiles.email_digest_enabled', b: true }
				]
			},
			columns: { id: true }
		});
	});

	it('only looks for a digest once the account is idle', async () => {
		findFirst.mockResolvedValue(APPROVED);
		await getSpendEligibility('u1', { background: true });
		expect(findDigestProfile).not.toHaveBeenCalled();
	});

	it('still exempts the demo template, which never signs in', async () => {
		findFirst.mockResolvedValue({
			is_approved: false,
			is_demo_template: true,
			deletion_requested_at: null,
			last_seen_at: null,
			createdAt: daysAgo(200)
		});
		expect(await getSpendEligibility('template', { background: true })).toEqual({
			allowed: true
		});
	});

	it('reports an expired demo as not approved rather than idle', async () => {
		findFirst.mockResolvedValue({ ...IDLE, is_approved: false });
		expect(await getSpendEligibility('demo', { background: true })).toEqual({
			allowed: false,
			reason: 'not_approved'
		});
	});
});
