/**
 * The stamp behind the idle rule: at most one write an hour per account, and
 * never a failed request. The edge worth pinning is the failure path — a write
 * that fails must not leave the throttle set, or the account reads as unused
 * for the rest of the hour and, repeated, long enough to pause its matching.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update, set, where } = vi.hoisted(() => {
	const where = vi.fn();
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	return { update, set, where };
});

vi.mock('drizzle-orm', () => ({
	and: (...args: unknown[]) => ({ op: 'and', args }),
	or: (...args: unknown[]) => ({ op: 'or', args }),
	eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
	lt: (a: unknown, b: unknown) => ({ op: 'lt', a, b }),
	isNull: (a: unknown) => ({ op: 'isNull', a })
}));
vi.mock('$lib/server/db', () => ({ dbDirect: { update } }));
vi.mock('$lib/server/db/schema', () => ({
	users: { id: 'users.id', last_seen_at: 'users.last_seen_at' }
}));

import { recordSeen, SEEN_STAMP_INTERVAL_MS } from '../last-seen';

const T0 = Date.parse('2026-09-29T12:00:00Z');

beforeEach(() => {
	update.mockClear();
	set.mockClear();
	where.mockReset();
	where.mockResolvedValue(undefined);
});

describe('recordSeen', () => {
	it('stamps the account with the time it was seen', () => {
		recordSeen('first', T0);
		expect(update).toHaveBeenCalledWith({ id: 'users.id', last_seen_at: 'users.last_seen_at' });
		expect(set).toHaveBeenCalledWith({ last_seen_at: new Date(T0) });
	});

	it('only overwrites a stamp older than the interval, so other processes do not rewrite it', () => {
		recordSeen('guarded', T0);
		expect(where).toHaveBeenCalledWith({
			op: 'and',
			args: [
				{ op: 'eq', a: 'users.id', b: 'guarded' },
				{
					op: 'or',
					args: [
						{ op: 'isNull', a: 'users.last_seen_at' },
						{
							op: 'lt',
							a: 'users.last_seen_at',
							b: new Date(T0 - SEEN_STAMP_INTERVAL_MS)
						}
					]
				}
			]
		});
	});

	it('writes once an hour per account, not once a request', () => {
		recordSeen('busy', T0);
		recordSeen('busy', T0 + 1_000);
		recordSeen('busy', T0 + SEEN_STAMP_INTERVAL_MS - 1);
		expect(update).toHaveBeenCalledTimes(1);

		recordSeen('busy', T0 + SEEN_STAMP_INTERVAL_MS);
		expect(update).toHaveBeenCalledTimes(2);
	});

	it('throttles each account on its own', () => {
		recordSeen('one', T0);
		recordSeen('two', T0);
		expect(update).toHaveBeenCalledTimes(2);
	});

	it('does not throw when the write fails, and tries again on the next request', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		where.mockRejectedValueOnce(new Error('connection reset'));

		expect(() => recordSeen('flaky', T0)).not.toThrow();
		await vi.waitFor(() => expect(warn).toHaveBeenCalled());

		recordSeen('flaky', T0 + 1_000);
		expect(update).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});

	it('does not throw when building the query throws, since every request calls it', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		update.mockImplementationOnce(() => {
			throw new Error('no such column');
		});

		expect(() => recordSeen('broken', T0)).not.toThrow();
		expect(warn).toHaveBeenCalled();

		recordSeen('broken', T0 + 1_000);
		expect(update).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});
});
