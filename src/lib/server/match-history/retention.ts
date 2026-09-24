/**
 * Bound `job_match_history` without losing any job's latest score.
 *
 * The matcher appends a row here every time it scores a (profile, job) pair,
 * and nothing has ever deleted one. That is on purpose: the table is the audit
 * trail that identified the 2026-06-27 rescore storm, and that class of bug is
 * still unexplained, so it is the one telemetry table that is **not** pruned
 * by default. `DEFAULT_RETENTION_DAYS` is 0 and the worker does nothing until
 * `SJS_MATCH_HISTORY_RETENTION_DAYS` is set.
 *
 * When it is set, the shape is the one `docs/MAINTENANCE.md` and
 * `planning/DATA-RETENTION.md` agreed:
 *
 * - every row younger than the window stays, so a storm is still fully
 *   visible for as long as anyone would investigate one;
 * - the newest row per `(profile_id, job_id)` stays **forever**, whatever its
 *   age, so the job page's history never goes empty and a pair scored once a
 *   year ago still shows its score.
 *
 * Everything else — an older row for a pair that has a newer one, past the
 * window — is deleted outright. There is nothing to tombstone: the row is a
 * score, a summary and a timestamp, and nothing references it.
 *
 * "Newest" is ordered by `date_created DESC NULLS LAST, id DESC`. The column
 * is nullable (default `now()`, never written null by the matcher, but the
 * schema allows it), so a dateless row must never be the one that stands in
 * for a pair's latest score while a dated one is deleted; and `id` breaks the
 * tie between two rows written in the same microsecond. A dateless row is
 * never deleted either: `NULL < cutoff` is not true, and a row whose age is
 * unknown is not provably outside the window.
 *
 * Deletion is NOT reversible. Idempotent — a repeat pass finds nothing.
 *
 * NOTE: like the prunes next door this reclaims space *for reuse by Postgres*;
 * the table file only shrinks on a rewrite. `scripts/prune-match-history.ts
 * --vacuum` does that by hand during maintenance.
 */

import { inArray, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { job_match_history } from '$lib/server/db/schema';

export interface MatchHistoryRetentionResult {
	rowsDeleted: number;
	/** True when the batch limit was hit, so prunable rows remain. */
	moreRemaining: boolean;
}

export interface MatchHistoryRetentionOptions {
	/** Rows older than this are deleted unless they are their pair's newest. */
	days: number;
	/**
	 * Cap on rows per pass, so a first run against a large backlog does not
	 * issue one enormous DELETE. The caller's schedule catches up over
	 * subsequent passes.
	 */
	limit?: number;
}

/**
 * 0 = disabled. The table is kept on purpose as an audit trail, so pruning it
 * is something an operator opts into, not something a deploy starts doing.
 */
export const DEFAULT_RETENTION_DAYS = 0;
/** The window the retention docs agreed on, for when it is switched on. */
export const AGREED_RETENTION_DAYS = 90;
export const DEFAULT_BATCH_LIMIT = 20_000;

/**
 * The ids a pass would delete: past the window and not the newest row of
 * their (profile, job) pair. Exported so the manual script can count exactly
 * what the job would remove rather than approximating it with its own SQL.
 */
export function prunableMatchHistorySql(cutoff: Date, limit?: number) {
	return sql`
    SELECT id FROM (
      SELECT
        id,
        date_created,
        row_number() OVER (
          PARTITION BY profile_id, job_id
          ORDER BY date_created DESC NULLS LAST, id DESC
        ) AS rn
      FROM job_match_history
    ) ranked
    WHERE rn > 1 AND date_created < ${cutoff}
    ORDER BY id
    ${limit === undefined ? sql`` : sql`LIMIT ${limit}`}
  `;
}

export async function pruneMatchHistory(
	opts: MatchHistoryRetentionOptions
): Promise<MatchHistoryRetentionResult> {
	const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
	const cutoff = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);

	// Select the batch by primary key first, then delete those ids. Postgres has
	// no DELETE ... LIMIT. A row the matcher inserts between the two statements
	// only makes the selected rows older relative to their pair, never the
	// newest, so the batch stays safe to delete.
	const batch = await queryRawDirect<{ id: number }>(prunableMatchHistorySql(cutoff, limit));

	if (batch.length === 0) return { rowsDeleted: 0, moreRemaining: false };

	const ids = batch.map((r) => r.id);
	const res = await db.delete(job_match_history).where(inArray(job_match_history.id, ids));

	return {
		rowsDeleted: res.rowCount ?? ids.length,
		moreRemaining: batch.length === limit
	};
}
