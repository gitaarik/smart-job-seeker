/**
 * Expire scraped job postings nobody has touched for a while.
 *
 * A `jobs` row is one posting, shared by every profile it matched, and until
 * this existed nothing ever deleted one: every posting a search run ever read
 * off LinkedIn, Indeed, Upwork or Wellfound stayed forever, with the recruiter
 * name in `job_poster`, whatever contact details the description carried and
 * the stripped page HTML. That is personal data about people we have no
 * relationship with, which is why planning/DATA-RETENTION.md (D4, adopted
 * 2026-11-15) bounds it where the applicant's own content (D3) is not bounded.
 *
 * What goes: a posting from a **browser-scraped** platform
 * (`job_platforms.fetch_mode = 'browser'`), not entered by hand, that no
 * profile has applied to, and that nothing has touched inside the window:
 *
 * - the posting itself was not created, edited or re-scraped since the cutoff
 *   (`date_created`, `date_updated`, `last_scraped` — a run that finds the
 *   posting still live re-scrapes it, so a live posting stays);
 * - no profile matched it, imported it, saved it, changed its status or
 *   attached a resource since the cutoff (`job_matches.date_created`,
 *   `job_importers`, `job_statuses`, `job_resources`).
 *
 * What stays: anything applied to, for as long as the application exists —
 * the posting is part of the applicant's record, and `applications.job_id`
 * would otherwise be nulled by the FK. Postings from `feed` platforms (public
 * ATS boards; the corpus has its own prune in ats/sweep) and hand-entered jobs
 * (`created_manually`, the applicant's own content) are never offered. A job
 * with no `date_created` is never offered either: an unknown age is not
 * provably outside the window.
 *
 * Deleting a job cascades to its matches, statuses, match history, importers
 * and resources, and nulls `search_task_run_items.job_id`. Match history for
 * an expired posting therefore goes with it; the agreed exception for the
 * applicant's own record is the application, not the score.
 *
 * Deletion is NOT reversible. Idempotent — a repeat pass finds nothing. The
 * worker runs it daily with `SJS_JOB_RETENTION_DAYS` (default 90, 0 disables);
 * `scripts/prune-jobs.ts` counts or applies it by hand, dry run by default.
 */

import { inArray, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { jobs } from '$lib/server/db/schema';

export interface JobRetentionResult {
	rowsDeleted: number;
	/** True when the batch limit was hit, so expirable jobs remain. */
	moreRemaining: boolean;
}

export interface JobRetentionOptions {
	/** A scraped posting untouched for longer than this is deleted. */
	days: number;
	/**
	 * Cap on jobs per pass. Each job cascades to its matches and history, so a
	 * first run against a large backlog is kept to bounded DELETEs; the
	 * caller's schedule catches up over subsequent passes.
	 */
	limit?: number;
}

/** The window planning/DATA-RETENTION.md publishes. */
export const DEFAULT_RETENTION_DAYS = 90;
/** Smaller than the row prunes next door: every job deleted here cascades. */
export const DEFAULT_BATCH_LIMIT = 2_000;

/**
 * The ids a pass would delete. Exported so the manual script can count exactly
 * what the job would remove rather than approximating it with its own SQL.
 */
export function expirableJobsSql(cutoff: Date, limit?: number) {
	return sql`
    SELECT j.id FROM jobs j
    JOIN job_platforms p ON p.id = j.job_platform_id
    WHERE p.fetch_mode = 'browser'
      AND NOT j.created_manually
      AND j.date_created < ${cutoff}
      AND (j.date_updated IS NULL OR j.date_updated < ${cutoff})
      AND (j.last_scraped IS NULL OR j.last_scraped < ${cutoff})
      AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id)
      AND NOT EXISTS (
        SELECT 1 FROM job_matches m
        WHERE m.job_id = j.id AND (m.date_created IS NULL OR m.date_created >= ${cutoff})
      )
      AND NOT EXISTS (
        SELECT 1 FROM job_statuses s
        WHERE s.job_id = j.id AND coalesce(s.date_updated, s.date_created) >= ${cutoff}
      )
      AND NOT EXISTS (
        SELECT 1 FROM job_importers i
        WHERE i.job_id = j.id AND greatest(i.date_created, i.shown_at) >= ${cutoff}
      )
      AND NOT EXISTS (
        SELECT 1 FROM job_resources r
        WHERE r.job_id = j.id AND (r.date_created IS NULL OR r.date_created >= ${cutoff})
      )
    ORDER BY j.id
    ${limit === undefined ? sql`` : sql`LIMIT ${limit}`}
  `;
}

export async function pruneExpiredJobs(opts: JobRetentionOptions): Promise<JobRetentionResult> {
	const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
	const cutoff = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);

	// Select the batch by primary key first, then delete those ids. Postgres has
	// no DELETE ... LIMIT. A job touched between the two statements is still
	// deleted — the window is 90 days, and a race of seconds does not change
	// what the policy says about it.
	const batch = await queryRawDirect<{ id: number }>(expirableJobsSql(cutoff, limit));

	if (batch.length === 0) return { rowsDeleted: 0, moreRemaining: false };

	const ids = batch.map((r) => Number(r.id));
	const res = await db.delete(jobs).where(inArray(jobs.id, ids));

	return {
		rowsDeleted: res.rowCount ?? ids.length,
		moreRemaining: batch.length === limit
	};
}
