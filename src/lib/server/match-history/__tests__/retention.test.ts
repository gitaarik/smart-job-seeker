/**
 * Tests for the match-history prune.
 *
 * The whole policy — keep the window, keep each pair's newest row forever —
 * lives in one SELECT, so that SELECT is what these read: what it partitions
 * by, how it orders "newest", and that it only offers rows that are both old
 * and superseded. Whether Postgres agrees is a different question, and one a
 * mock cannot answer; `scripts/verify-match-history-prune.ts` asks it against a
 * real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mockQuery = vi.fn();
const mockWhereDelete = vi.fn();
const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete });

vi.mock('$lib/server/db', () => ({
	queryRawDirect: (q: SQL) => mockQuery(q),
	dbDirect: {
		delete: (...a: unknown[]) => mockDelete(...a)
	}
}));

import { job_match_history } from '$lib/server/db/schema';
import {
	AGREED_RETENTION_DAYS,
	DEFAULT_BATCH_LIMIT,
	DEFAULT_RETENTION_DAYS,
	prunableMatchHistorySql,
	pruneMatchHistory
} from '../retention';

const DAY = 24 * 60 * 60 * 1000;
const dialect = new PgDialect();

/** The SELECT a prune call actually sent, whitespace-collapsed. */
function sentQuery(): { sql: string; params: unknown[] } {
	const q = mockQuery.mock.calls[0]?.[0] as SQL;
	expect(q, 'no select was issued').toBeTruthy();
	const { sql, params } = dialect.sqlToQuery(q);
	return { sql: sql.replace(/\s+/g, ' ').trim(), params };
}

beforeEach(() => {
	vi.clearAllMocks();
	mockDelete.mockReturnValue({ where: mockWhereDelete });
	mockWhereDelete.mockResolvedValue({ rowCount: 0 });
	mockQuery.mockResolvedValue([]);
});

describe('defaults', () => {
	it('is disabled unless an operator opts in', () => {
		// The table is an audit trail kept on purpose. A deploy must not start
		// deleting it just because the code shipped.
		expect(DEFAULT_RETENTION_DAYS).toBe(0);
	});

	it('records the agreed window for when it is switched on', () => {
		expect(AGREED_RETENTION_DAYS).toBe(90);
	});
});

describe('prunableMatchHistorySql', () => {
	it("keeps each (profile, job) pair's newest row whatever its age", () => {
		const { sql } = dialect.sqlToQuery(prunableMatchHistorySql(new Date()));
		const flat = sql.replace(/\s+/g, ' ');

		expect(flat).toContain('PARTITION BY profile_id, job_id');
		// A dateless row must not stand in for the latest score; id breaks ties.
		expect(flat).toContain('ORDER BY date_created DESC NULLS LAST, id DESC');
		expect(flat).toContain('rn > 1');
	});

	it('only offers rows older than the cutoff', () => {
		const cutoff = new Date('2026-01-01T00:00:00Z');
		const { sql, params } = dialect.sqlToQuery(prunableMatchHistorySql(cutoff));

		expect(sql.replace(/\s+/g, ' ')).toContain('date_created < $1');
		expect(params[0]).toBe(cutoff);
	});

	it('omits LIMIT when counting and binds it when batching', () => {
		const unbounded = dialect.sqlToQuery(prunableMatchHistorySql(new Date()));
		expect(unbounded.sql).not.toContain('LIMIT');

		const bounded = dialect.sqlToQuery(prunableMatchHistorySql(new Date(), 7));
		expect(bounded.sql).toContain('LIMIT $2');
		expect(bounded.params[1]).toBe(7);
	});
});

describe('pruneMatchHistory', () => {
	it('issues no delete when nothing is prunable', async () => {
		const r = await pruneMatchHistory({ days: 90 });

		expect(r).toEqual({ rowsDeleted: 0, moreRemaining: false });
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it('measures the window back from now', async () => {
		const before = Date.now();

		await pruneMatchHistory({ days: 90 });

		const cutoff = sentQuery().params[0] as Date;
		expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 90 * DAY - 1000);
		expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 90 * DAY);
	});

	it('deletes exactly the selected ids and reports the count', async () => {
		mockQuery.mockResolvedValueOnce([{ id: 4 }, { id: 9 }]);
		mockWhereDelete.mockResolvedValueOnce({ rowCount: 2 });

		const r = await pruneMatchHistory({ days: 90 });

		expect(r.rowsDeleted).toBe(2);
		expect(mockDelete).toHaveBeenCalledWith(job_match_history);
		const where = dialect.sqlToQuery(mockWhereDelete.mock.calls[0][0] as SQL);
		expect(where.sql).toBe('"job_match_history"."id" in ($1, $2)');
		expect(where.params).toEqual([4, 9]);
	});

	it('applies the default batch limit', async () => {
		await pruneMatchHistory({ days: 90 });

		expect(sentQuery().params[1]).toBe(DEFAULT_BATCH_LIMIT);
	});

	it('reports moreRemaining when the batch limit is hit', async () => {
		mockQuery.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

		const r = await pruneMatchHistory({ days: 90, limit: 3 });

		expect(r.moreRemaining).toBe(true);
	});

	it('does not report moreRemaining on a partial batch', async () => {
		mockQuery.mockResolvedValueOnce([{ id: 1 }]);

		const r = await pruneMatchHistory({ days: 90, limit: 3 });

		expect(r.moreRemaining).toBe(false);
	});

	it('falls back to the id count when the driver reports no rowCount', async () => {
		mockQuery.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
		mockWhereDelete.mockResolvedValueOnce({});

		const r = await pruneMatchHistory({ days: 90 });

		expect(r.rowsDeleted).toBe(2);
	});
});
