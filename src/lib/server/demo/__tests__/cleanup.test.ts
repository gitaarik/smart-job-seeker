/**
 * Tests for the demo sweep, specifically the half that stops an expired demo
 * costing money rather than the half that stops it being reachable.
 *
 * Cutting access and cutting spend are separate things here: the matcher works
 * off profiles and never reads `users.is_approved`, so for a while a demo
 * nobody could log into went on being scored against every new job. The
 * assertions below are on rendered SQL, like provision.test.ts, so they pin
 * what would actually be sent — above all the `is_demo` guard, since the
 * failure mode of getting that wrong is unenrolling a real user from their own
 * matching.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PgDialect, QueryBuilder } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

/** Every update issued, as (table name, values, rendered where). */
const updates: { table: string; values: Record<string, unknown>; where: string }[] = [];
let updateRowCount = 0;

vi.mock('$lib/server/db', async () => {
	const { getTableName } = await import('drizzle-orm');
	const qb = new QueryBuilder();
	return {
		dbDirect: {
			query: { demo_links: { findMany: mockFindMany } },
			// Deletes are the access half and already covered by the link flip;
			// swallow them so the test speaks only about the spend half.
			delete: () => ({ where: async () => ({ rowCount: 0 }) }),
			// Real query builder, so `inArray(col, <subquery>)` renders as it would
			// in production instead of against a hand-made stand-in.
			select: (cols: Record<string, unknown>) => qb.select(cols as never),
			update: (table: never) => ({
				set: (values: Record<string, unknown>) => ({
					where: async (where: SQL) => {
						updates.push({
							table: getTableName(table),
							values,
							where: new PgDialect().sqlToQuery(where).sql
						});
						return { rowCount: updateRowCount };
					}
				})
			})
		}
	};
});

import { cleanupExpiredDemoLinks } from '../cleanup';

const STALE_LINK = {
	id: 4,
	status: 'active',
	demo_user_id: 'demo-user-1',
	expires_at: new Date('2026-07-27')
};

describe('cleanupExpiredDemoLinks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		updates.length = 0;
		updateRowCount = 1;
	});

	it('unenrols the expired demo profile from community matching', async () => {
		mockFindMany.mockResolvedValue([STALE_LINK]);

		const result = await cleanupExpiredDemoLinks();

		const unenrol = updates.find((u) => u.table === 'match_config');
		expect(unenrol).toBeDefined();
		expect(unenrol!.values).toEqual({ match_community_jobs: false });
		expect(result.profilesUnenrolled).toBe(1);
	});

	it('scopes the unenrol to demo accounts only', async () => {
		mockFindMany.mockResolvedValue([STALE_LINK]);

		await cleanupExpiredDemoLinks();

		// The guard that keeps a demo sweep away from a real user's own matching.
		// Without it this statement reaches every profile in the subquery.
		const where = updates.find((u) => u.table === 'match_config')!.where;
		expect(where).toContain('"is_demo"');
		expect(where).toContain('"profiles"');
	});

	it('only touches profiles that are still enrolled', async () => {
		mockFindMany.mockResolvedValue([STALE_LINK]);

		await cleanupExpiredDemoLinks();

		// Idempotence is the point: the sweep runs hourly and must not rewrite
		// rows it already switched off.
		expect(updates.find((u) => u.table === 'match_config')!.where).toContain(
			'"match_community_jobs"'
		);
	});

	it('does nothing when no link is stale', async () => {
		mockFindMany.mockResolvedValue([]);

		const result = await cleanupExpiredDemoLinks();

		expect(updates).toHaveLength(0);
		expect(result).toEqual({ linksExpired: 0, usersDeactivated: 0, profilesUnenrolled: 0 });
	});

	it('reports the unenrol even when the link was expired long ago', async () => {
		// The interesting sweep: the link flipped to `expired` weeks back, so
		// linksExpired is 0, but the profile was still being scored until now.
		mockFindMany.mockResolvedValue([{ ...STALE_LINK, status: 'revoked' }]);
		updateRowCount = 1;

		const result = await cleanupExpiredDemoLinks();

		expect(result.profilesUnenrolled).toBe(1);
	});
});
