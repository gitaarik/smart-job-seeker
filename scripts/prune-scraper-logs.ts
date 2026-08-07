#!/usr/bin/env npx tsx
/**
 * Reclaim space taken by old scraper run telemetry.
 *
 * A scrape run writes a log line per action plus, when the task has debug
 * screenshots enabled, a PNG per line. Nothing ever deleted either. On the dev
 * DB `scraper_logs` reached 159k rows / 62 MB with 58% older than a month, and
 * the screenshot volume reached 407 MB of which 359 MB had gone untouched for
 * 30 days — the files being by far the larger half.
 *
 * Unlike the ai_chats prune this deletes outright: there is nothing in an old
 * log line worth keeping, and the only readers (the staff debug view and the
 * per-run log view) look at recent runs. `search_task_runs` itself is left
 * alone, so the runs list and its stats survive while the detail goes empty.
 *
 * The screenshot sweep is part of the same job because `screenshot_path` is the
 * only pointer to a file on disk — pruning rows without it would leave
 * permanently unreachable garbage. It sweeps by directory mtime, which also
 * collects files whose run row was cascade-deleted long ago.
 *
 * Deletion is NOT reversible. Dry-run is the default.
 *
 * Runs inside the app container (the DB host only resolves there, and the
 * screenshot volume is mounted there). From cloud/:
 *
 *   npm run db:prune-scraper-logs                      # dry run, 30-day window
 *   npm run db:prune-scraper-logs -- --days 7          # dry run, shorter window
 *   npm run db:prune-scraper-logs -- --apply
 *   npm run db:prune-scraper-logs -- --apply --vacuum
 *
 * A plain DELETE only marks the old tuples dead; the file on disk does not
 * shrink until the table is rewritten. Pass --vacuum for a VACUUM FULL, which
 * takes an ACCESS EXCLUSIVE lock (nothing can read the table meanwhile) and
 * needs free disk roughly equal to the current table size. Skip it on a busy
 * server and let autovacuum reuse the space instead. Note the screenshot files
 * are freed immediately either way — --vacuum only concerns the tables.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import {
	pruneScraperLogs,
	pruneScraperScreenshots,
	SCREENSHOTS_ROOT
} from '$lib/server/scraper-logs/retention';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const doVacuum = args.includes('--vacuum');
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? parseInt(args[daysArg + 1], 10) : 30;

if (!Number.isFinite(days) || days < 1) {
	console.error(`Invalid --days value: ${args[daysArg + 1]}`);
	process.exit(1);
}

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/** Count and size what the sweep would remove, without removing it. */
async function surveyScreenshots(root: string) {
	const cutoffMs = cutoff.getTime();
	let dirs = 0,
		files = 0,
		bytes = 0;
	let liveDirs = 0,
		liveFiles = 0,
		liveBytes = 0;

	let taskDirs: string[];
	try {
		taskDirs = await readdir(root);
	} catch {
		return { dirs, files, bytes, liveDirs, liveFiles, liveBytes, missing: true };
	}

	for (const task of taskDirs) {
		const taskPath = join(root, task);
		let runDirs: string[];
		try {
			runDirs = await readdir(taskPath);
		} catch {
			continue;
		}
		for (const run of runDirs) {
			const runPath = join(taskPath, run);
			let entries: string[];
			try {
				entries = await readdir(runPath);
			} catch {
				continue;
			}
			let newest = 0,
				size = 0,
				count = 0;
			for (const e of entries) {
				try {
					const info = await stat(join(runPath, e));
					newest = Math.max(newest, info.mtimeMs);
					size += info.size;
					count++;
				} catch {
					/* vanished mid-scan */
				}
			}
			if (newest < cutoffMs) {
				dirs++;
				files += count;
				bytes += size;
			} else {
				liveDirs++;
				liveFiles += count;
				liveBytes += size;
			}
		}
	}
	return { dirs, files, bytes, liveDirs, liveFiles, liveBytes, missing: false };
}

async function main() {
	console.log(`Pruning scraper telemetry older than ${days} days`);
	console.log(`  cutoff:  ${cutoff.toISOString()}`);
	console.log(`  mode:    ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
	console.log('');

	const [before] = await queryRawDirect<{
		logs_total: string;
		logs_prunable: string;
		steps_total: string;
		logs_bytes: string;
	}>(sql`
    SELECT
      (SELECT count(*) FROM scraper_logs)::text AS logs_total,
      (SELECT count(*) FROM scraper_logs WHERE timestamp < ${cutoff})::text
        AS logs_prunable,
      (SELECT count(*) FROM scraper_log_steps)::text AS steps_total,
      pg_size_pretty(pg_total_relation_size('scraper_logs')) AS logs_bytes
  `);

	console.log('scraper_logs');
	console.log(`  rows total:     ${before.logs_total}`);
	console.log(`  rows prunable:  ${before.logs_prunable}`);
	console.log(`  table size:     ${before.logs_bytes}`);
	console.log(`  steps total:    ${before.steps_total}`);

	const shots = await surveyScreenshots(SCREENSHOTS_ROOT);
	console.log('');
	console.log(`screenshots (${SCREENSHOTS_ROOT})`);
	if (shots.missing) {
		console.log('  volume not mounted here — nothing to sweep');
	} else {
		console.log(
			`  keeping:        ${shots.liveFiles} file(s) in ${shots.liveDirs} run ` +
				`dir(s), ${(shots.liveBytes / 1e6).toFixed(1)} MB`
		);
		console.log(
			`  sweeping:       ${shots.files} file(s) in ${shots.dirs} run dir(s), ` +
				`${(shots.bytes / 1e6).toFixed(1)} MB`
		);
	}

	if (!apply) {
		console.log('\nDry run — no changes written.');
		return;
	}

	// Same code path the worker runs on a schedule, looped until drained — the
	// manual run is expected to clear the whole backlog in one go.
	console.log('\nDeleting log rows…');
	let logs = 0,
		steps = 0;
	for (;;) {
		const r = await pruneScraperLogs({ days });
		logs += r.logsDeleted;
		steps += r.stepsDeleted;
		if (!r.moreRemaining) break;
		console.log(`  …${logs} rows so far`);
	}
	console.log(`  deleted ${logs} log row(s), ${steps} step row(s)`);

	console.log('\nSweeping screenshots…');
	const swept = await pruneScraperScreenshots({ days });
	console.log(
		`  removed ${swept.filesRemoved} file(s) in ${swept.dirsRemoved} run ` +
			`dir(s), ${(swept.bytesFreed / 1e6).toFixed(1)} MB freed`
	);

	if (doVacuum) {
		// VACUUM FULL cannot run inside a transaction block.
		console.log('\nVACUUM FULL scraper_logs — this locks the table…');
		await db.execute(sql`VACUUM FULL scraper_logs`);
		console.log('  done');
	} else {
		console.log(
			'\nSkipped VACUUM FULL — table space is marked reusable but the file ' +
				'has not shrunk. Re-run with --vacuum to reclaim it. (Screenshot ' +
				'space was freed immediately.)'
		);
	}

	const [after] = await queryRawDirect<{ bytes: string }>(sql`
    SELECT pg_size_pretty(pg_total_relation_size('scraper_logs')) AS bytes
  `);
	console.log(`\n  scraper_logs size now: ${after.bytes}`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
