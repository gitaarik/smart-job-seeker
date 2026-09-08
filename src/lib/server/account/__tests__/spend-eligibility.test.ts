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
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
/** Columns the query asked for, so the row stays one row. */
let requestedColumns: Record<string, boolean> | undefined;

vi.mock('drizzle-orm', () => ({ eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }) }));
vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			users: {
				findFirst: (args: { columns?: Record<string, boolean> }) => {
					requestedColumns = args.columns;
					return findFirst(args);
				}
			}
		}
	}
}));
vi.mock('$lib/server/db/schema', () => ({ users: { id: 'users.id' } }));

import { describeSpendBlock, getSpendEligibility } from '../spend-eligibility';

const APPROVED = { is_approved: true, is_demo_template: false, deletion_requested_at: null };

beforeEach(() => {
	findFirst.mockReset();
	requestedColumns = undefined;
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
			deletion_requested_at: null
		});
		expect(await getSpendEligibility('template')).toEqual({ allowed: true });
	});

	it('reads three columns, not the whole user row', async () => {
		findFirst.mockResolvedValue(APPROVED);
		await getSpendEligibility('u1');
		expect(requestedColumns).toEqual({
			is_approved: true,
			is_demo_template: true,
			deletion_requested_at: true
		});
	});

	it('describes every reason it can return', () => {
		for (const reason of ['user_missing', 'not_approved', 'deletion_pending'] as const) {
			expect(describeSpendBlock(reason)).toMatch(/\S/);
		}
	});
});
