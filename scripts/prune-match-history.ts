#!/usr/bin/env npx tsx
/**
 * Bound `job_match_history`: keep the window, plus each pair's newest row.
 *
 * The matcher appends a row every time it scores a (profile, job) pair and
 * nothing ever deletes one. That is deliberate — the table is the audit trail
 * that identified the 2026-06-27 rescore storm — so the worker only prunes it
 * when `SJS_MATCH_HISTORY_RETENTION_DAYS` is set, and this script is how to
 * see what that would do before setting it.
 *
 * What goes: rows older than the window that are not the newest row of their
 * (profile_id, job_id) pair. What stays: everything inside the window, and the
 * newest row per pair forever, so no job's history ever goes empty. The query
 * is the one the worker runs — see $lib/server/match-history/retention.ts.
 *
 * Deletion is NOT reversible. Dry-run is the default.
 *
 * Runs inside the app container (the DB host only resolves there). From cloud/:
 *
 *   npm run db:prune-match-history                     # dry run, 90-day window
 *   npm run db:prune-match-history -- --days 180       # dry run, longer window
 *   npm run db:prune-match-history -- --apply
 *   npm run db:prune-match-history -- --apply --vacuum
 *
 * A plain DELETE only marks the old tuples dead; the file on disk does not
 * shrink until the table is rewritten. Pass --vacuum for a VACUUM FULL, which
 * takes an ACCESS EXCLUSIVE lock (nothing can read the table meanwhile, and
 * the matcher writes to it) and needs free disk roughly equal to the current
 * table size. Skip it on a busy server and let autovacuum reuse the space.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import {
	AGREED_RETENTION_DAYS,
	prunableMatchHistorySql,
	pruneMatchHistory
} from '$lib/server/match-history/retention';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const doVacuum = args.includes('--vacuum');
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? parseInt(args[daysArg + 1], 10) : AGREED_RETENTION_DAYS;

if (!Number.isFinite(days) || days < 1) {
	console.error(`Invalid --days value: ${args[daysArg + 1]}`);
	process.exit(1);
}

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function main() {
	console.log(`Pruning job_match_history older than ${days} days (newest per pair kept)`);
	console.log(`  cutoff:  ${cutoff.toISOString()}`);
	console.log(`  mode:    ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
	console.log('');

	const [before] = await queryRawDirect<{
		total: string;
		older: string;
		pairs: string;
		bytes: string;
	}>(sql`
    SELECT
      (SELECT count(*) FROM job_match_history)::text AS total,
      (SELECT count(*) FROM job_match_history WHERE date_created < ${cutoff})::text AS older,
      (SELECT count(*) FROM (
        SELECT 1 FROM job_match_history GROUP BY profile_id, job_id
      ) p)::text AS pairs,
      pg_size_pretty(pg_total_relation_size('job_match_history')) AS bytes
  `);
	// Counted with the worker's own query, not an approximation of it.
	const [prunable] = await queryRawDirect<{ n: string }>(
		sql`SELECT count(*)::text AS n FROM (${prunableMatchHistorySql(cutoff)}) p`
	);

	console.log(`  rows total:            ${before.total}`);
	console.log(`  (profile, job) pairs:  ${before.pairs}`);
	console.log(`  rows past the window:  ${before.older}`);
	console.log(`  rows prunable:         ${prunable.n}  (past the window, not their pair's newest)`);
	console.log(`  table size:            ${before.bytes}`);

	if (!apply) {
		console.log('\nDry run — no changes written.');
		return;
	}

	// Same code path the worker runs on a schedule, looped until drained — the
	// manual run is expected to clear the whole backlog in one go.
	console.log('\nDeleting rows…');
	let deleted = 0;
	for (;;) {
		const r = await pruneMatchHistory({ days });
		deleted += r.rowsDeleted;
		if (!r.moreRemaining) break;
		console.log(`  …${deleted} rows so far`);
	}
	console.log(`  deleted ${deleted} row(s)`);

	if (doVacuum) {
		// VACUUM FULL cannot run inside a transaction block.
		console.log('\nVACUUM FULL job_match_history — this locks it…');
		await db.execute(sql`VACUUM FULL job_match_history`);
		console.log('  done');
	} else {
		console.log(
			'\nSkipped VACUUM FULL — table space is marked reusable but the file ' +
				'has not shrunk. Re-run with --vacuum to reclaim it.'
		);
	}

	const [after] = await queryRawDirect<{ bytes: string }>(sql`
    SELECT pg_size_pretty(pg_total_relation_size('job_match_history')) AS bytes
  `);
	console.log(`\n  job_match_history size now: ${after.bytes}`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
