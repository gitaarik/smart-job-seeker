/**
 * Tests for the expired-session and token prune.
 *
 * What matters is the column the cutoff is read from (`expiresAt`, not the
 * row's age — a session renewed daily is young and expired at once), that the
 * grace is measured past expiry rather than before it, and that the batching
 * tells the worker to come back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn();
const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

const mockWhereDelete = vi.fn();
const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: (...a: unknown[]) => mockSelect(...a),
		delete: (...a: unknown[]) => mockDelete(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	lt: vi.fn((c: unknown, v: unknown) => ({ col: c, cutoff: v })),
	inArray: vi.fn((c: unknown, v: unknown) => ({ col: c, ids: v }))
}));

vi.mock('$lib/server/db/schema', () => ({
	sessions: { id: 'sessions.id', expiresAt: 'sessions.expiresAt' },
	verifications: { id: 'verifications.id', expiresAt: 'verifications.expiresAt' }
}));

import {
	DEFAULT_BATCH_LIMIT,
	GRACE_DAYS,
	pruneExpiredSessions,
	pruneExpiredVerifications
} from '../retention';

const DAY = 24 * 60 * 60 * 1000;

const TABLES = [
	{ name: 'sessions', prune: pruneExpiredSessions, table: 'sessions' },
	{ name: 'verifications', prune: pruneExpiredVerifications, table: 'verifications' }
] as const;

describe.each(TABLES)('prune $name', ({ prune, table }) => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSelect.mockReturnValue({ from: mockFrom });
		mockFrom.mockReturnValue({ where: mockWhereSelect });
		mockWhereSelect.mockReturnValue({ limit: mockLimit });
		mockDelete.mockReturnValue({ where: mockWhereDelete });
		mockLimit.mockResolvedValue([]);
		mockWhereDelete.mockResolvedValue({ rowCount: 0 });
	});

	it('selects on expiresAt, one grace day past expiry', async () => {
		const now = new Date('2026-06-01T12:00:00Z');

		await prune({ now });

		const where = mockWhereSelect.mock.calls[0][0] as { col: string; cutoff: Date };
		expect(where.col).toBe(`${table}.expiresAt`);
		expect(where.cutoff.getTime()).toBe(now.getTime() - GRACE_DAYS * DAY);
	});

	it('issues no delete when nothing has expired', async () => {
		const r = await prune();

		expect(r).toEqual({ rowsDeleted: 0, moreRemaining: false });
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it('deletes exactly the selected ids and reports the count', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
		mockWhereDelete.mockResolvedValueOnce({ rowCount: 2 });

		const r = await prune();

		expect(r.rowsDeleted).toBe(2);
		const where = mockWhereDelete.mock.calls[0][0] as { col: string; ids: string[] };
		expect(where.col).toBe(`${table}.id`);
		expect(where.ids).toEqual(['a', 'b']);
	});

	it('applies the default batch limit and reports when it is hit', async () => {
		await prune();
		expect(mockLimit).toHaveBeenCalledWith(DEFAULT_BATCH_LIMIT);

		mockLimit.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
		expect((await prune({ limit: 2 })).moreRemaining).toBe(true);

		mockLimit.mockResolvedValueOnce([{ id: 'a' }]);
		expect((await prune({ limit: 2 })).moreRemaining).toBe(false);
	});
});
