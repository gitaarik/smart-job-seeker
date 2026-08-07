/**
 * Record the work arrangement that a job's `office_location` is really naming.
 *
 * Some postings carry no explicit remote field and put the whole signal in the
 * location: "Worldwide", "Werk van thuis", "Remote". Until the importer was
 * taught to keep what it recognised, those rows ended up with no work_location
 * and a region of null — indistinguishable from a job nothing was known about.
 * On preview that was 763 rows, "Worldwide" (804 occurrences) and "Werk van
 * thuis" (326) chief among them.
 *
 * This only ever ADDS. It does not clear office_location, does not touch
 * region, and never overwrites an explicit work_location — if a posting says
 * hybrid while its location says "Worldwide", the posting wins.
 *
 * Safe to re-run: rows that already have an arrangement are skipped, so a
 * second pass is a no-op. Dry-run by default.
 *
 *   # from cloud/oss, against whichever DB the direct-connection URL points at
 *   docker compose exec app node dist-scripts/backfill-work-location.mjs
 *   docker compose exec app node dist-scripts/backfill-work-location.mjs --apply
 */

import { dbDirect as db } from '$lib/server/db';
import { eq, isNotNull } from 'drizzle-orm';
import { jobs } from '$lib/server/db/schema';
import { normalizeWorkLocation } from '$lib/data/job-normalize';

const APPLY = process.argv.includes('--apply');

function isEmptyArrangement(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

async function main() {
	const rows = await db
		.select({
			id: jobs.id,
			office_location: jobs.office_location,
			work_location: jobs.work_location,
			region: jobs.region
		})
		.from(jobs)
		.where(isNotNull(jobs.office_location));

	console.log(`Scanning ${rows.length} jobs with an office_location…\n`);

	const changes: {
		id: number;
		loc: string;
		arrangement: string[];
		setsWorkLocation: boolean;
	}[] = [];

	for (const row of rows) {
		const loc = row.office_location;
		if (!loc) continue;
		const arrangement = normalizeWorkLocation(loc);
		if (!arrangement) continue; // a real place — leave it alone

		// This script only ever ADDS a work_location. It deliberately does not
		// clear office_location, even though a value like "Worldwide" names no
		// place.
		//
		// The first draft did clear it, guarded by "classifyRegion found nothing".
		// The dry run showed what that means in practice: it would have blanked
		// "Remote in Wisconsin", "Remote Brazil" and "Remote (Pacific, Central or
		// Eastern)" — places the classifier cannot read *yet*. Deleting the strings
		// we have not learned to parse is precisely backwards, and unlike a wrong
		// region it cannot be recomputed afterwards.
		//
		// A stray "Worldwide" in office_location costs nothing: region stays null,
		// which is correct, and the arrangement is now recorded where it belongs.
		const setsWorkLocation = isEmptyArrangement(row.work_location);
		if (!setsWorkLocation) continue; // explicit value wins; nothing to do

		changes.push({ id: row.id, loc, arrangement, setsWorkLocation });
	}

	if (changes.length === 0) {
		console.log('✅ No office_location holds a work arrangement.');
		return;
	}

	const bucket = new Map<string, number>();
	for (const c of changes) {
		const key = `${c.loc.slice(0, 38).padEnd(38)} -> ${c.arrangement.join('+')}`;
		bucket.set(key, (bucket.get(key) ?? 0) + 1);
	}

	console.log(
		`${changes.length} rows name a work arrangement in office_location and\n` +
			`have no work_location of their own. office_location is left untouched.\n`
	);
	for (const [key, n] of [...bucket].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
		console.log(`  ${String(n).padStart(5)}  ${key}`);
	}

	if (!APPLY) {
		console.log('\nDry run — re-run with --apply to write these changes.');
		return;
	}

	console.log('\nApplying…');
	let done = 0;
	for (const c of changes) {
		await db
			.update(jobs)
			.set({
				work_location: c.arrangement
			})
			.where(eq(jobs.id, c.id));
		done++;
		if (done % 100 === 0) console.log(`  ${done}/${changes.length}`);
	}
	console.log(`✅ Updated ${done} rows.`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.then(() => process.exit(0));
