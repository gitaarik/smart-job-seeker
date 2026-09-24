#!/usr/bin/env npx tsx
/**
 * The match-history prune's selection, against a real database, self-cleaning.
 *
 * The whole policy lives in one window-function SELECT
 * (`prunableMatchHistorySql` in $lib/server/match-history/retention.ts). The
 * unit tests pin what that SQL says; this asks whether Postgres agrees, on the
 * cases where getting it wrong would lose a job's only score:
 *
 *   - a pair whose rows are all past the window keeps exactly its newest;
 *   - a pair with recent rows loses only its old ones;
 *   - a pair scored once, long ago, keeps that row;
 *   - the same job under two profiles is two pairs, not one;
 *   - a dateless row neither stands in for the newest nor gets deleted;
 *   - two rows with the same timestamp keep the higher id.
 *
 * It creates its own profiles, jobs and history rows, checks which of *its*
 * rows the query offers, deletes those through the same `inArray` path the
 * worker uses, checks what survived, and removes everything it made. It never
 * deletes a row that was there before it started — which is also why it
 * does not call `pruneMatchHistory()` itself: that would prune the whole table.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-match-history-prune.ts
 *
 * or from cloud/: npm run db:verify-match-history-prune
 */
import { inArray } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { job_match_history, jobs, profiles } from '$lib/server/db/schema';
import {
	AGREED_RETENTION_DAYS,
	prunableMatchHistorySql
} from '$lib/server/match-history/retention';

const DAY = 24 * 60 * 60 * 1000;
const cutoff = new Date(Date.now() - AGREED_RETENTION_DAYS * DAY);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

const madeProfileIds: number[] = [];
const madeJobIds: number[] = [];

async function main() {
	const [p1, p2] = await db
		.insert(profiles)
		.values([{ name: 'verify-match-history-prune A' }, { name: 'verify-match-history-prune B' }])
		.returning({ id: profiles.id });
	madeProfileIds.push(p1.id, p2.id);

	const made = await db
		.insert(jobs)
		.values(Array.from({ length: 5 }, (_, i) => ({ title: `verify-match-history-prune ${i}` })))
		.returning({ id: jobs.id });
	madeJobIds.push(...made.map((j) => j.id));
	const [allOld, mixed, once, dateless, tie] = madeJobIds;

	/** Insert one row and remember it under a label. */
	const rows = new Map<string, number>();
	async function row(label: string, profile_id: number, job_id: number, at: Date | null) {
		const [r] = await db
			.insert(job_match_history)
			.values({ profile_id, job_id, score: 50, date_created: at })
			.returning({ id: job_match_history.id });
		rows.set(label, r.id);
	}

	const tieAt = daysAgo(120);
	await row('allOld-200', p1.id, allOld, daysAgo(200));
	await row('allOld-150', p1.id, allOld, daysAgo(150));
	await row('allOld-100', p1.id, allOld, daysAgo(100));
	await row('otherProfile-300', p2.id, allOld, daysAgo(300));
	await row('mixed-200', p1.id, mixed, daysAgo(200));
	await row('mixed-10', p1.id, mixed, daysAgo(10));
	await row('mixed-5', p1.id, mixed, daysAgo(5));
	await row('once-400', p1.id, once, daysAgo(400));
	await row('dateless-null', p1.id, dateless, null);
	await row('dateless-200', p1.id, dateless, daysAgo(200));
	await row('tie-first', p1.id, tie, tieAt);
	await row('tie-second', p1.id, tie, tieAt);

	const ours = new Set(rows.values());
	const offered = (await queryRawDirect<{ id: number }>(prunableMatchHistorySql(cutoff)))
		.map((r) => Number(r.id))
		.filter((id) => ours.has(id));
	const label = (id: number) => [...rows].find(([, v]) => v === id)?.[0] ?? String(id);
	const offeredLabels = offered.map(label).sort();

	const expected = ['allOld-150', 'allOld-200', 'mixed-200', 'tie-first'];
	check(
		'offers exactly the superseded rows past the window',
		JSON.stringify(offeredLabels) === JSON.stringify(expected),
		offeredLabels.join(', ')
	);

	// The batched form must offer a subset of the same rows, capped.
	const batched = await queryRawDirect<{ id: number }>(prunableMatchHistorySql(cutoff, 1));
	check('LIMIT caps the batch', batched.length <= 1, batched.length);

	await db.delete(job_match_history).where(inArray(job_match_history.id, offered));

	const left = await db
		.select({ id: job_match_history.id })
		.from(job_match_history)
		.where(inArray(job_match_history.id, [...ours]));
	const survivors = left.map((r) => label(r.id)).sort();
	check(
		'every pair still has its newest row',
		['allOld-100', 'mixed-5', 'once-400', 'otherProfile-300', 'dateless-200', 'tie-second'].every(
			(l) => survivors.includes(l)
		),
		survivors.join(', ')
	);
	check('rows inside the window survive', survivors.includes('mixed-10'));
	check('a dateless row is never deleted', survivors.includes('dateless-null'));

	const again = (await queryRawDirect<{ id: number }>(prunableMatchHistorySql(cutoff)))
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
		// Deleting the jobs and profiles cascades their history rows.
		if (madeJobIds.length) await db.delete(jobs).where(inArray(jobs.id, madeJobIds));
		if (madeProfileIds.length)
			await db.delete(profiles).where(inArray(profiles.id, madeProfileIds));
		console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
		process.exit(failures === 0 ? 0 : 1);
	});
