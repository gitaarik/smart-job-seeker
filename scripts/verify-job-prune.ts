#!/usr/bin/env npx tsx
/**
 * The scraped-job expiry's selection, against a real database, self-cleaning.
 *
 * The policy lives in one SELECT (`expirableJobsSql` in
 * $lib/server/jobs/retention.ts). The unit tests pin what that SQL says; this
 * asks whether Postgres agrees, on the cases where getting it wrong would
 * delete something the policy keeps:
 *
 *   - an old scraped posting nobody touched is offered;
 *   - the same posting applied to is not, however old;
 *   - a recent re-scrape, match, import, status change or resource keeps it;
 *   - a posting from a feed platform, or entered by hand, is never offered;
 *   - a posting with no date_created is never offered.
 *
 * It creates its own platforms, profile and jobs, checks which of *its* jobs
 * the query offers, deletes those the way the worker does, and removes
 * everything it made. It never calls `pruneExpiredJobs()` itself: that would
 * expire the whole table.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-job-prune.ts
 *
 * or from cloud/: npm run db:verify-job-prune
 */
import { inArray } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import {
	applications,
	job_importers,
	job_matches,
	job_platforms,
	job_resources,
	job_statuses,
	jobs,
	profiles
} from '$lib/server/db/schema';
import { DEFAULT_RETENTION_DAYS, expirableJobsSql } from '$lib/server/jobs/retention';

const DAY = 24 * 60 * 60 * 1000;
const cutoff = new Date(Date.now() - DEFAULT_RETENTION_DAYS * DAY);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const OLD = daysAgo(200);
const RECENT = daysAgo(5);

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

const madePlatformIds: number[] = [];
const madeProfileIds: number[] = [];
const madeJobIds: number[] = [];
const tag = `verify-job-prune-${Date.now()}`;

async function main() {
	const [browser, feed] = await db
		.insert(job_platforms)
		.values([
			{
				name: `${tag} browser`,
				url: 'https://example.invalid',
				key: `${tag}-b`,
				fetch_mode: 'browser'
			},
			{ name: `${tag} feed`, url: 'https://example.invalid', key: `${tag}-f`, fetch_mode: 'feed' }
		])
		.returning({ id: job_platforms.id });
	madePlatformIds.push(browser.id, feed.id);

	const [profile] = await db.insert(profiles).values({ name: tag }).returning({ id: profiles.id });
	madeProfileIds.push(profile.id);

	const made = new Map<string, number>();
	async function job(
		label: string,
		v: Partial<typeof jobs.$inferInsert> & { job_platform_id: number | null }
	) {
		const [r] = await db
			.insert(jobs)
			.values({
				title: `${tag} ${label}`,
				date_created: OLD,
				date_updated: OLD,
				last_scraped: OLD,
				...v
			})
			.returning({ id: jobs.id });
		made.set(label, r.id);
		madeJobIds.push(r.id);
		return r.id;
	}

	await job('untouched', { job_platform_id: browser.id });
	await job('feed', { job_platform_id: feed.id });
	await job('manual', { job_platform_id: browser.id, created_manually: true });
	await job('dateless', { job_platform_id: browser.id, date_created: null });
	await job('rescraped', { job_platform_id: browser.id, last_scraped: RECENT });
	await job('edited', { job_platform_id: browser.id, date_updated: RECENT });
	const applied = await job('applied', { job_platform_id: browser.id });
	const matched = await job('matched', { job_platform_id: browser.id });
	const oldMatch = await job('old-match', { job_platform_id: browser.id });
	const saved = await job('saved', { job_platform_id: browser.id });
	const imported = await job('imported', { job_platform_id: browser.id });
	const resourced = await job('resourced', { job_platform_id: browser.id });

	await db
		.insert(applications)
		.values({ profile_id: profile.id, job_id: applied, date_created: OLD });
	await db.insert(job_matches).values([
		{ profile_id: profile.id, job_id: matched, score: 50, date_created: RECENT },
		{ profile_id: profile.id, job_id: oldMatch, score: 50, date_created: OLD }
	]);
	await db.insert(job_statuses).values({
		profile_id: profile.id,
		job_id: saved,
		status: 'saved',
		date_created: OLD,
		date_updated: RECENT
	});
	await db
		.insert(job_importers)
		.values({ profile_id: profile.id, job_id: imported, date_created: RECENT });
	await db.insert(job_resources).values({ job_id: resourced, name: tag, date_created: RECENT });

	const ours = new Set(made.values());
	const label = (id: number) => [...made].find(([, v]) => v === id)?.[0] ?? String(id);
	const offered = (await queryRawDirect<{ id: number }>(expirableJobsSql(cutoff)))
		.map((r) => Number(r.id))
		.filter((id) => ours.has(id));
	const offeredLabels = offered.map(label).sort();

	check(
		'offers exactly the untouched postings',
		JSON.stringify(offeredLabels) === JSON.stringify(['old-match', 'untouched']),
		offeredLabels.join(', ')
	);
	check('an applied-to posting is never offered', !offeredLabels.includes('applied'));
	check('a feed posting is never offered', !offeredLabels.includes('feed'));
	check('a hand-entered posting is never offered', !offeredLabels.includes('manual'));
	check('a dateless posting is never offered', !offeredLabels.includes('dateless'));

	const batched = await queryRawDirect<{ id: number }>(expirableJobsSql(cutoff, 1));
	check('LIMIT caps the batch', batched.length <= 1, batched.length);

	await db.delete(jobs).where(inArray(jobs.id, offered));

	const [app] = await db
		.select({ job_id: applications.job_id })
		.from(applications)
		.where(inArray(applications.job_id, [applied]));
	check('the application still points at its posting', app?.job_id === applied);

	const again = (await queryRawDirect<{ id: number }>(expirableJobsSql(cutoff)))
		.map((r) => Number(r.id))
		.filter((id) => ours.has(id));
	check('a second pass finds nothing (idempotent)', again.length === 0, again.length);
}

main()
	.catch((err) => {
		console.error(err);
		failures++;
	})
	.finally(async () => {
		// Deleting the jobs cascades matches, statuses, importers and resources;
		// the application is nulled, so it is deleted with the profile.
		if (madeJobIds.length) await db.delete(jobs).where(inArray(jobs.id, madeJobIds));
		if (madeProfileIds.length)
			await db.delete(profiles).where(inArray(profiles.id, madeProfileIds));
		if (madePlatformIds.length)
			await db.delete(job_platforms).where(inArray(job_platforms.id, madePlatformIds));
		console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
		process.exit(failures === 0 ? 0 : 1);
	});
