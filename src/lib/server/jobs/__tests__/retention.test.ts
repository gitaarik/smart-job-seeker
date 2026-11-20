/**
 * Tests for the scraped-job expiry.
 *
 * The whole policy — which postings are even eligible, what counts as touching
 * one, and that an applied-to posting is never offered — lives in one SELECT,
 * so that SELECT is what these read. Whether Postgres agrees is a different
 * question, and one a mock cannot answer; `scripts/verify-job-prune.ts` asks
 * it against a real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mockQuery = vi.fn();
const mockWhereDelete = vi.fn();
const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete });

vi.mock('#lib/server/db/index.ts', () => ({
	queryRawDirect: (q: SQL) => mockQuery(q),
	dbDirect: {
		delete: (...a: unknown[]) => mockDelete(...a)
	}
}));

import { jobs } from '#lib/server/db/schema.ts';
import {
	DEFAULT_BATCH_LIMIT,
	DEFAULT_RETENTION_DAYS,
	expirableJobsSql,
	pruneExpiredJobs
} from '../retention';

const DAY = 24 * 60 * 60 * 1000;
const dialect = new PgDialect();

function flat(q: SQL): { sql: string; params: unknown[] } {
	const { sql, params } = dialect.sqlToQuery(q);
	return { sql: sql.replace(/\s+/g, ' ').trim(), params };
}

/** The SELECT a prune call actually sent. */
function sentQuery(): { sql: string; params: unknown[] } {
	const q = mockQuery.mock.calls[0]?.[0] as SQL;
	expect(q, 'no select was issued').toBeTruthy();
	return flat(q);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockDelete.mockReturnValue({ where: mockWhereDelete });
	mockWhereDelete.mockResolvedValue({ rowCount: 0 });
	mockQuery.mockResolvedValue([]);
});

describe('defaults', () => {
	it('publishes the agreed window', () => {
		expect(DEFAULT_RETENTION_DAYS).toBe(90);
	});
});

describe('expirableJobsSql', () => {
	const cutoff = new Date('2026-01-01T00:00:00Z');

	it('only offers browser-scraped postings that were not entered by hand', () => {
		const { sql } = flat(expirableJobsSql(cutoff));
		expect(sql).toContain(
			"JOIN job_platforms p ON p.id = j.job_platform_id WHERE p.fetch_mode = 'browser'"
		);
		expect(sql).toContain('AND NOT j.created_manually');
	});

	it('never offers a posting someone applied to', () => {
		const { sql } = flat(expirableJobsSql(cutoff));
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id)');
	});

	it('requires the posting itself to be old, re-scrapes included', () => {
		const { sql, params } = flat(expirableJobsSql(cutoff));
		// A dateless job is never offered: `NULL < cutoff` is not true.
		expect(sql).toContain('j.date_created < $1');
		expect(sql).toContain('(j.date_updated IS NULL OR j.date_updated < $2)');
		expect(sql).toContain('(j.last_scraped IS NULL OR j.last_scraped < $3)');
		expect(params.slice(0, 3)).toEqual([cutoff, cutoff, cutoff]);
	});

	it('treats a match, status change, import or resource inside the window as touching it', () => {
		const { sql } = flat(expirableJobsSql(cutoff));
		expect(sql).toMatch(
			/FROM job_matches m WHERE m\.job_id = j\.id AND \(m\.date_created IS NULL OR m\.date_created >= \$\d\)/
		);
		expect(sql).toMatch(
			/FROM job_statuses s WHERE s\.job_id = j\.id AND coalesce\(s\.date_updated, s\.date_created\) >= \$\d/
		);
		expect(sql).toMatch(
			/FROM job_importers i WHERE i\.job_id = j\.id AND greatest\(i\.date_created, i\.shown_at\) >= \$\d/
		);
		expect(sql).toMatch(
			/FROM job_resources r WHERE r\.job_id = j\.id AND \(r\.date_created IS NULL OR r\.date_created >= \$\d\)/
		);
	});

	it('binds the same cutoff to every clause', () => {
		const { params } = flat(expirableJobsSql(cutoff));
		expect(params).toHaveLength(7);
		expect(params.every((p) => p === cutoff)).toBe(true);
	});

	it('omits LIMIT when counting and binds it when batching', () => {
		expect(flat(expirableJobsSql(cutoff)).sql).not.toContain('LIMIT');

		const bounded = flat(expirableJobsSql(cutoff, 7));
		expect(bounded.sql).toContain('LIMIT $8');
		expect(bounded.params[7]).toBe(7);
	});
});

describe('pruneExpiredJobs', () => {
	it('issues no delete when nothing is expirable', async () => {
		const r = await pruneExpiredJobs({ days: 90 });

		expect(r).toEqual({ rowsDeleted: 0, moreRemaining: false });
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it('measures the window back from now', async () => {
		const before = Date.now();

		await pruneExpiredJobs({ days: 90 });

		const cutoff = sentQuery().params[0] as Date;
		expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 90 * DAY - 1000);
		expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 90 * DAY);
	});

	it('deletes exactly the selected jobs and reports the count', async () => {
		// Postgres drivers hand integer ids back as strings on raw queries.
		mockQuery.mockResolvedValueOnce([{ id: '4' }, { id: 9 }]);
		mockWhereDelete.mockResolvedValueOnce({ rowCount: 2 });

		const r = await pruneExpiredJobs({ days: 90 });

		expect(r.rowsDeleted).toBe(2);
		expect(mockDelete).toHaveBeenCalledWith(jobs);
		const where = dialect.sqlToQuery(mockWhereDelete.mock.calls[0][0] as SQL);
		expect(where.sql).toBe('"jobs"."id" in ($1, $2)');
		expect(where.params).toEqual([4, 9]);
	});

	it('applies the default batch limit', async () => {
		await pruneExpiredJobs({ days: 90 });

		expect(sentQuery().params[7]).toBe(DEFAULT_BATCH_LIMIT);
	});

	it('reports moreRemaining only when the batch limit is hit', async () => {
		mockQuery.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);
		expect((await pruneExpiredJobs({ days: 90, limit: 3 })).moreRemaining).toBe(true);

		mockQuery.mockResolvedValueOnce([{ id: 1 }]);
		expect((await pruneExpiredJobs({ days: 90, limit: 3 })).moreRemaining).toBe(false);
	});

	it('falls back to the id count when the driver reports no rowCount', async () => {
		mockQuery.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
		mockWhereDelete.mockResolvedValueOnce({});

		expect((await pruneExpiredJobs({ days: 90 })).rowsDeleted).toBe(2);
	});
});
