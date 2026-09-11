/**
 * Re-export the `collected_data` blobs that predate a change to the snapshot.
 *
 * Adding a column to `PROFILE_SNAPSHOT_COLUMNS` changes what `exportProfile`
 * WOULD write. It does not change a single existing row, and nothing notices:
 * the refresh in worker.ts gates on `isCollectedDataStale`, which compares the
 * blob against `profiles.date_updated`. A snapshot change touches no profile
 * row, so every existing blob stays "fresh" while missing the new field, and
 * the prompt that asked for it goes on reading as if the applicant has none —
 * the same silence as a misspelt key, from the other end.
 *
 * That is not hypothetical. `remote_start_year` was added to the snapshot on
 * 2026-09-11 precisely because the import suggester had been asking for it
 * since it was written; without this pass the fix would have reached only
 * profiles that happened to be edited afterwards.
 *
 * The test is structural rather than per-field: a blob is stale if its
 * top-level keys do not cover `EXPORTED_PROFILE_KEYS`. Every snapshot column
 * appears as a key even when its value is null (`fetchProfileData` spreads the
 * row), so an absent key means the blob was written by an older shape, whatever
 * the field was. Re-run it after any snapshot change, not just this one.
 *
 * Cheap and idempotent — `exportProfile` is a handful of queries and no LLM
 * call — but it rewrites rows, so it is dry-run by default like its siblings.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-collected-data.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-collected-data.ts --apply
 *
 *   # on a deployed box, where the image has no src/ (see build-ops-scripts.mjs)
 *   docker compose exec app node dist-scripts/backfill-collected-data.mjs --apply
 */

import { dbDirect as db } from '$lib/server/db';
import { asc } from 'drizzle-orm';
import { collected_data } from '$lib/server/db/schema';
import { EXPORTED_PROFILE_KEYS, exportProfile } from '$lib/server/profile/export';

const APPLY = process.argv.includes('--apply');

/** The blob's top-level keys, or null if the row cannot be read as an object. */
function blobKeys(data: string | null): Set<string> | null {
	if (!data) return null;
	try {
		const parsed: unknown = JSON.parse(data);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		return new Set(Object.keys(parsed));
	} catch {
		return null;
	}
}

async function main() {
	const rows = await db
		.select({
			profileId: collected_data.profile_id,
			data: collected_data.data
		})
		.from(collected_data)
		.orderBy(asc(collected_data.profile_id));

	const stale: { profileId: number; missing: string[] }[] = [];
	let unreadable = 0;
	let orphaned = 0;

	for (const row of rows) {
		// `collected_data.profile_id` is nullable, and there is nothing to
		// re-export a blob from without one. Counted rather than skipped, because
		// a row that cannot be repaired is the kind of thing a silent `continue`
		// hides for years.
		if (row.profileId == null) {
			orphaned++;
			continue;
		}
		const keys = blobKeys(row.data);
		if (!keys) {
			unreadable++;
			// An unreadable blob is worse than a stale one, and re-exporting is
			// exactly the repair, so it goes in the same list with no missing
			// names to report.
			stale.push({ profileId: row.profileId, missing: [] });
			continue;
		}
		const missing = EXPORTED_PROFILE_KEYS.filter((k) => !keys.has(k));
		if (missing.length) stale.push({ profileId: row.profileId, missing });
	}

	console.log(`${rows.length} collected_data rows, ${stale.length} behind the current snapshot`);
	if (unreadable) console.log(`  (${unreadable} of them unreadable as JSON objects)`);
	if (orphaned) console.log(`  (${orphaned} with no profile_id, which this cannot repair)`);
	for (const { profileId, missing } of stale) {
		console.log(`  profile ${profileId}: missing ${missing.join(', ') || '(unreadable)'}`);
	}

	if (!stale.length) return;

	if (!APPLY) {
		console.log('\nDry run. Re-run with --apply to re-export these.');
		return;
	}

	let ok = 0;
	for (const { profileId } of stale) {
		// exportProfile reports failure by returning, not raising — the mistake
		// worker.ts documents at its own call site. Count both.
		const result = await exportProfile(profileId);
		if (result.success) {
			ok++;
		} else {
			console.warn(`  ⚠️ profile ${profileId}: ${result.message}`);
		}
	}
	console.log(`\nRe-exported ${ok}/${stale.length}.`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
