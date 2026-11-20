#!/usr/bin/env npx tsx
/**
 * Expire scraped job postings nobody has touched inside the window.
 *
 * The worker does this daily (`SJS_JOB_RETENTION_DAYS`, default 90); this
 * script is how to see what a pass would delete before it runs, and how to
 * drain a backlog in one go. The selection is the worker's own query
 * (`expirableJobsSql` in $lib/server/jobs/retention.ts): browser-scraped,
 * not entered by hand, never applied to, and nothing — re-scrape, match,
 * import, status change, resource — since the cutoff.
 *
 * Deletion is NOT reversible and cascades to the job's matches, statuses,
 * match history, importers and resources. Dry-run is the default.
 *
 * Runs inside the app container (the DB host only resolves there). From cloud/:
 *
 *   npm run db:prune-jobs                       # dry run, 90-day window
 *   npm run db:prune-jobs -- --days 180         # dry run, longer window
 *   npm run db:prune-jobs -- --apply
 *   npm run db:prune-jobs -- --apply --vacuum
 *
 * A plain DELETE only marks the old tuples dead; pass --vacuum for a VACUUM
 * FULL of `jobs` and `job_matches`, which locks both while it runs.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '#lib/server/db/index.ts';
import {
	DEFAULT_RETENTION_DAYS,
	expirableJobsSql,
	pruneExpiredJobs
} from '#lib/server/jobs/retention.ts';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const doVacuum = args.includes('--vacuum');
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? parseInt(args[daysArg + 1], 10) : DEFAULT_RETENTION_DAYS;

if (!Number.isFinite(days) || days < 1) {
	console.error(`Invalid --days value: ${args[daysArg + 1]}`);
	process.exit(1);
}

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function main() {
	console.log(`Expiring scraped jobs untouched for ${days} days`);
	console.log(`  cutoff:  ${cutoff.toISOString()}`);
	console.log(`  mode:    ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
	console.log('');

	const [before] = await queryRawDirect<{
		total: string;
		scraped: string;
		applied: string;
		bytes: string;
	}>(sql`
    SELECT
      (SELECT count(*) FROM jobs)::text AS total,
      (SELECT count(*) FROM jobs j JOIN job_platforms p ON p.id = j.job_platform_id
         WHERE p.fetch_mode = 'browser' AND NOT j.created_manually)::text AS scraped,
      (SELECT count(DISTINCT job_id) FROM applications WHERE job_id IS NOT NULL)::text AS applied,
      pg_size_pretty(pg_total_relation_size('jobs') + pg_total_relation_size('job_matches')) AS bytes
  `);
	// Counted with the worker's own query, not an approximation of it.
	const expirable = await queryRawDirect<{ platform: string; n: string }>(sql`
    SELECT p.name AS platform, count(*)::text AS n
    FROM (${expirableJobsSql(cutoff)}) e
    JOIN jobs j ON j.id = e.id
    JOIN job_platforms p ON p.id = j.job_platform_id
    GROUP BY p.name ORDER BY count(*) DESC
  `);
	const expirableTotal = expirable.reduce((n, r) => n + Number(r.n), 0);

	console.log(`  jobs total:               ${before.total}`);
	console.log(`  browser-scraped:          ${before.scraped}`);
	console.log(`  applied to (never expire): ${before.applied}`);
	console.log(`  expirable:                ${expirableTotal}`);
	for (const r of expirable) console.log(`    ${r.platform.padEnd(24)} ${r.n}`);
	console.log(`  jobs + job_matches size:  ${before.bytes}`);

	if (!apply) {
		console.log('\nDry run — no changes written.');
		return;
	}

	// Same code path the worker runs on a schedule, looped until drained.
	console.log('\nDeleting jobs…');
	let deleted = 0;
	for (;;) {
		const r = await pruneExpiredJobs({ days });
		deleted += r.rowsDeleted;
		if (!r.moreRemaining) break;
		console.log(`  …${deleted} jobs so far`);
	}
	console.log(`  deleted ${deleted} job(s)`);

	if (doVacuum) {
		console.log('\nVACUUM FULL jobs, job_matches — this locks them…');
		await db.execute(sql`VACUUM FULL jobs`);
		await db.execute(sql`VACUUM FULL job_matches`);
		console.log('  done');
	} else {
		console.log(
			'\nSkipped VACUUM FULL — table space is marked reusable but the files ' +
				'have not shrunk. Re-run with --vacuum to reclaim it.'
		);
	}

	const [after] = await queryRawDirect<{ bytes: string }>(sql`
    SELECT pg_size_pretty(pg_total_relation_size('jobs') + pg_total_relation_size('job_matches')) AS bytes
  `);
	console.log(`\n  jobs + job_matches size now: ${after.bytes}`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
