/**
 * Report how well `jobs.region` is populated — and, more to the point, how much
 * of the gap is actually a defect.
 *
 * A raw "N jobs have no region" count is close to meaningless, because null is
 * the CORRECT answer for most of them. Measured on preview before this existed:
 * 2,122 null regions, of which
 *
 *   - 826 were remote jobs. A remote job names no place; null is right.
 *   - 424 had no office_location at all. Nothing to derive from.
 *   - the rest were genuine misclassifier misses.
 *
 * Reporting 2,122 as a defect count makes the number un-actionable: it can
 * never reach zero, so it never gets looked at. This splits it so the last
 * line is the only one worth chasing.
 *
 * Read-only. Run it after any classifyRegion change, alongside
 * backfill-job-regions, to see whether the change actually moved anything.
 *
 *   docker compose exec app node dist-scripts/audit-job-regions.mjs
 */

import { dbDirect as db } from '$lib/server/db';
import { jobs } from '$lib/server/db/schema';
import { classifyRegion } from '$lib/data/job-taxonomy';
import { normalizeWorkLocation } from '$lib/data/job-normalize';

function isRemote(workLocation: unknown): boolean {
	return Array.isArray(workLocation) && workLocation.includes('remote');
}

function pct(n: number, total: number): string {
	if (total === 0) return '—';
	return `${((n / total) * 100).toFixed(1)}%`;
}

async function main() {
	const rows = await db
		.select({
			region: jobs.region,
			office_location: jobs.office_location,
			work_location: jobs.work_location
		})
		.from(jobs);

	const total = rows.length;
	const classified = rows.filter((r) => r.region !== null);
	const unclassified = rows.filter((r) => r.region === null);

	// Why is region null?
	const remote = unclassified.filter((r) => isRemote(r.work_location));
	const rest = unclassified.filter((r) => !isRemote(r.work_location));

	const noLocation = rest.filter((r) => !r.office_location || r.office_location.trim() === '');
	const withLocation = rest.filter((r) => r.office_location && r.office_location.trim() !== '');

	// A location that reads as a work arrangement ("Worldwide") is not a place
	// either — those want backfill-work-location, not a classifier change.
	const arrangementNotPlace = withLocation.filter(
		(r) => normalizeWorkLocation(r.office_location) !== null
	);
	const stillAPlace = withLocation.filter((r) => normalizeWorkLocation(r.office_location) === null);

	// Split what is left by whether the CURRENT classifier can read it. Without
	// this the report tells you to add a pattern for a city you added an hour
	// ago — the row is null only because the backfill has not run in this
	// environment yet. Region is a derived column; the two failures look
	// identical in the data and want opposite responses.
	const pendingBackfill = stillAPlace.filter((r) => classifyRegion(r.office_location) !== null);
	const realMisses = stillAPlace.filter((r) => classifyRegion(r.office_location) === null);

	console.log(`jobs: ${total}\n`);
	console.log(
		`  region set          ${String(classified.length).padStart(6)}  ${pct(classified.length, total)}`
	);
	console.log(
		`  region null         ${String(unclassified.length).padStart(6)}  ${pct(unclassified.length, total)}\n`
	);
	console.log('of the nulls:\n');
	console.log(
		`  remote job                  ${String(remote.length).padStart(6)}   correct — names no place`
	);
	console.log(
		`  no office_location          ${String(noLocation.length).padStart(6)}   correct — nothing to derive from`
	);
	console.log(
		`  location is an arrangement  ${String(arrangementNotPlace.length).padStart(6)}   run backfill-work-location`
	);
	console.log(
		`  classifier reads it now     ${String(pendingBackfill.length).padStart(6)}   run backfill-job-regions`
	);
	console.log(
		`  ── unclassified location    ${String(realMisses.length).padStart(6)}   ← the only defect count`
	);

	if (realMisses.length > 0) {
		const byValue = new Map<string, number>();
		for (const r of realMisses) {
			const key = r.office_location!.trim().slice(0, 50);
			byValue.set(key, (byValue.get(key) ?? 0) + 1);
		}
		console.log('\nmost common unclassified locations:\n');
		for (const [loc, n] of [...byValue].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
			console.log(`  ${String(n).padStart(5)}  ${loc}`);
		}
		console.log(
			'\nEach is a classifyRegion gap. Add a pattern, add the string to\n' +
				'job-taxonomy.test.ts, then re-run backfill-job-regions.'
		);
	}

	// Sanity check: the stored region should equal what the current classifier
	// says. If it doesn't, a backfill is outstanding for this environment.
	const stale = rows.filter(
		(r) => (classifyRegion(r.office_location) ?? null) !== (r.region ?? null)
	);
	console.log(
		stale.length === 0
			? '\n✅ Every stored region matches the current classifier.'
			: `\n⚠️  ${stale.length} rows disagree with the current classifier — ` +
					'run backfill-job-regions.'
	);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.then(() => process.exit(0));
