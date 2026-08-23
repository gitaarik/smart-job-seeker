#!/usr/bin/env npx tsx
/**
 * Delete `files` rows nothing references any more, and the bytes under them.
 *
 * Until `$lib/server/uploads/reap.ts` existed, deleting a profile cascaded the
 * rows that pointed at a file and left the `files` row and its blob behind.
 * The reap fixed the flow; it cannot fix the history. This is the one-off
 * sweep for what past deletions already left — 334 of dev's 1,145 rows when it
 * was measured on 2026-08-22, each one still carrying `filename_download`,
 * which is usually the applicant's own name.
 *
 * Reachability is the only ownership signal `files` has, and the "is anything
 * still pointing at this" check reads the FK list from `pg_constraint` rather
 * than from a list in the code — so a tenth reference added to `files` is
 * accounted for here without anyone remembering to come back.
 *
 * **Recent rows are never touched.** `uploadFile()` inserts the row and then
 * hands the id to its caller to store, so an unreferenced row seconds old is
 * an upload in flight. `--min-age-days` (default 7) is what keeps this sweep
 * off them, and there is no way to set it to zero.
 *
 * Deletion is NOT reversible. Dry-run is the default.
 *
 * Runs inside the app container (the DB host only resolves there, and the
 * uploads volume is mounted there). From cloud/:
 *
 *   npm run db:sweep-orphaned-files                        # dry run
 *   npm run db:sweep-orphaned-files -- --min-age-days 30   # dry run, stricter
 *   npm run db:sweep-orphaned-files -- --apply
 */
import {
	DEFAULT_ORPHAN_MIN_AGE_DAYS,
	findOrphanedFiles,
	reapFileRefs
} from '$lib/server/uploads/reap';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const ageArg = args.indexOf('--min-age-days');
const minAgeDays = ageArg >= 0 ? parseInt(args[ageArg + 1], 10) : DEFAULT_ORPHAN_MIN_AGE_DAYS;

if (!Number.isFinite(minAgeDays) || minAgeDays < 1) {
	console.error(`Invalid --min-age-days value: ${args[ageArg + 1]}`);
	process.exit(1);
}

/** Chunk the delete so one statement never binds tens of thousands of ids. */
const CHUNK = 500;

function mb(bytes: number): string {
	return `${(bytes / 1e6).toFixed(1)} MB`;
}

async function main() {
	console.log(`Sweeping files rows nothing references, older than ${minAgeDays} days`);
	console.log(`  mode:    ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
	console.log('');

	const orphans = await findOrphanedFiles({ minAgeDays });
	if (orphans.length === 0) {
		console.log('Nothing orphaned. (This is what a healthy tree looks like.)');
		return;
	}

	const bytes = orphans.reduce((sum, o) => sum + (o.filesize ?? 0), 0);
	const rowOnly = orphans.filter((o) => !o.filenameDisk).length;
	console.log(`  orphaned rows:  ${orphans.length}`);
	console.log(`  bytes on disk:  ${mb(bytes)}`);
	if (rowOnly > 0) {
		console.log(`  row-only:       ${rowOnly} (no filename_disk — nothing to unlink)`);
	}
	console.log(`  oldest:         ${orphans[0].createdOn.toISOString().slice(0, 10)}`);
	console.log(
		`  newest:         ${orphans[orphans.length - 1].createdOn.toISOString().slice(0, 10)}`
	);

	console.log('\n  sample:');
	for (const o of orphans.slice(0, 10)) {
		console.log(
			`    ${o.createdOn.toISOString().slice(0, 10)}  ` +
				`${mb(o.filesize ?? 0).padStart(9)}  ${o.filenameDownload}`
		);
	}
	if (orphans.length > 10) console.log(`    …and ${orphans.length - 10} more`);

	if (!apply) {
		console.log('\nDry run — no changes written.');
		return;
	}

	console.log('\nDeleting…');
	let filesDeleted = 0;
	let filesRetained = 0;
	let blobsUnlinked = 0;
	const failures: { path: string; error: string }[] = [];

	for (let i = 0; i < orphans.length; i += CHUNK) {
		// reapFileRefs re-checks "nothing references this" inside the DELETE, so a
		// row that acquired a reference between the scan above and this statement
		// is left alone rather than deleted from under its new owner.
		const chunk = orphans.slice(i, i + CHUNK).map((o) => o.id);
		const r = await reapFileRefs({ fileIds: chunk, mediaPaths: [] });
		filesDeleted += r.filesDeleted;
		filesRetained += r.filesRetained;
		blobsUnlinked += r.blobsUnlinked;
		failures.push(...r.failures);
		console.log(`  …${filesDeleted}/${orphans.length} rows`);
	}

	console.log(`\n  deleted ${filesDeleted} row(s), unlinked ${blobsUnlinked} blob(s)`);
	if (filesRetained > 0) {
		console.log(
			`  kept ${filesRetained} row(s) that gained a reference since the scan — ` +
				're-run to see whether they are still referenced'
		);
	}
	if (failures.length > 0) {
		console.log(`\n  ${failures.length} blob(s) could not be unlinked:`);
		for (const f of failures.slice(0, 20)) console.log(`    ${f.path}: ${f.error}`);
		if (failures.length > 20) console.log(`    …and ${failures.length - 20} more`);
		console.log('  Their rows are gone, so re-running will not find them again.');
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
