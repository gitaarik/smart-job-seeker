/**
 * Age out jobs nobody has seen re-posted: `hiring` -> `stale`.
 *
 * The scraper already has an age check, but it only runs **at import** and only
 * against `date_posted` (`isJobTooOld`, `SJS_MAX_JOB_AGE_DAYS`). Nothing ever
 * revisits a row afterwards, so a job ingested while genuinely open silently
 * stays `hiring` forever — long after the posting it came from closed.
 *
 * ## Two decisions worth knowing about
 *
 * **It writes `stale`, not `expired`.** The TODO asked for `expired`, but the
 * column's live vocabulary is `hiring` / `stale` / `closed` / `draft`, and
 * `stale` already means "too old to be worth applying to" — the scraper sets it
 * for exactly that reason. A second word for one concept would leave every
 * reader asking how they differ, and `isJobClosed()` would have to learn the
 * new one too.
 *
 * **It measures from `date_created`, not `date_posted`.** Posting age is
 * already handled at import; the gap this closes is *ingestion* age — how long
 * since we last had evidence the job existed. A job posted a year ago but
 * scraped yesterday is a job we just saw live.
 *
 * Only `hiring` rows are touched. `closed` is a fact the source told us,
 * `draft` is someone's unfinished manual entry, and `stale` is already done —
 * overwriting any of them would lose information to gain nothing.
 *
 * Nothing downstream filters on `stale` today: it is shown, not enforced. So
 * this is safe to run, and if `stale` ever starts gating matching or listing,
 * that is a separate decision made in one place rather than implied here.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/mark-stale-jobs.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/mark-stale-jobs.ts --apply
 *   npx dotenvx run -f ../.env -- npx tsx scripts/mark-stale-jobs.ts --days 90 --apply
 */

import { dbDirect as db } from '$lib/server/db';
import { and, count, eq, inArray, lt } from 'drizzle-orm';
import { jobs } from '$lib/server/db/schema';

const APPLY = process.argv.includes('--apply');

/**
 * Default 60 days — the TODO's "2 months". Deliberately its own number rather
 * than `SJS_MAX_JOB_AGE_DAYS` (30): that one decides what to bother importing,
 * measured against the posting date. This one decides when what we imported has
 * gone cold. Tying them together would mean a change to import filtering
 * silently re-dated every row already in the table.
 */
function staleAfterDays(): number {
	const flagIndex = process.argv.indexOf('--days');
	if (flagIndex !== -1) {
		const parsed = Number(process.argv[flagIndex + 1]);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			throw new Error(`--days needs a positive number, got: ${process.argv[flagIndex + 1]}`);
		}
		return parsed;
	}
	return Number(process.env.SJS_JOB_STALE_AFTER_DAYS ?? 60);
}

async function main() {
	const days = staleAfterDays();
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);

	const candidates = await db
		.select({
			id: jobs.id,
			title: jobs.title,
			date_created: jobs.date_created
		})
		.from(jobs)
		.where(and(eq(jobs.status, 'hiring'), lt(jobs.date_created, cutoff)));

	const [{ total }] = await db
		.select({ total: count() })
		.from(jobs)
		.where(eq(jobs.status, 'hiring'));

	console.log(
		`Jobs still marked 'hiring': ${total}\n` +
			`Ingested before ${cutoff.toISOString().slice(0, 10)} (${days}d): ${candidates.length}\n`
	);

	if (candidates.length === 0) {
		console.log("✅ Nothing to age out — every 'hiring' job is newer than the cutoff.");
		return;
	}

	// Oldest first: the tail is the interesting part, and it shows at a glance
	// whether this is a routine trim or a first run against years of backlog.
	const sorted = [...candidates].sort(
		(a, b) => (a.date_created?.getTime() ?? 0) - (b.date_created?.getTime() ?? 0)
	);
	console.log('oldest of them:\n');
	for (const row of sorted.slice(0, 10)) {
		const when = row.date_created?.toISOString().slice(0, 10) ?? '(no date)';
		console.log(`  ${when}  ${(row.title ?? '(untitled)').slice(0, 62)}`);
	}
	if (sorted.length > 10) console.log(`  … and ${sorted.length - 10} more`);

	if (!APPLY) {
		console.log(`\nDry run — re-run with --apply to mark ${candidates.length} job(s) stale.`);
		return;
	}

	console.log(`\nApplying…`);
	const ids = candidates.map((c) => c.id);
	let done = 0;
	// Chunked so a first run against a large backlog is not one enormous
	// statement holding row locks across the whole table.
	const CHUNK = 500;
	for (let i = 0; i < ids.length; i += CHUNK) {
		const slice = ids.slice(i, i + CHUNK);
		await db
			.update(jobs)
			.set({ status: 'stale' })
			.where(and(eq(jobs.status, 'hiring'), inArray(jobs.id, slice)));
		done += slice.length;
		console.log(`  ${done}/${ids.length}`);
	}
	console.log(`✅ Marked ${done} job(s) stale.`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.then(() => process.exit(0));
