/**
 * Replay the auth-block policy over real run history and report what it would
 * have done.
 *
 * A policy like this is easy to unit-test into a shape that looks right and
 * still be wrong about the data. This is where that gets caught: it walks each
 * task's runs in chronological order, asks the policy after every one, and
 * then *removes the runs its answer would have removed*. While a task is
 * backed off its scheduled runs are skipped until the retry window opens;
 * while it is switched off they are skipped entirely; manual runs always
 * happen; and a success resets everything.
 *
 * Two numbers come out, and they are reported separately rather than netted
 * off against each other:
 *
 * - `saved-fail` — scheduled failures that would not have happened. The point.
 * - `cost-ok`    — scheduled runs that *would have succeeded* and were skipped
 *                  because the task was backed off or switched off. Under
 *                  backoff these are recoveries noticed a couple of days late;
 *                  under a switch-off they are a job search gone quiet. This
 *                  is the number to argue with.
 *
 * It has already earned its keep twice: it caught a streak-walk bug that a
 * green unit suite missed, and it falsified the feature's original premise by
 * showing that every multi-run auth block in the data healed unattended, which
 * is why the policy backs off instead of switching tasks off.
 *
 *   # against whichever DB SJS_DATABASE_URL points at
 *   docker compose exec -T app npx tsx scripts/backtest-auth-block.ts
 *   # against rows exported from another box (see --help for the query)
 *   docker compose exec -T app npx tsx scripts/backtest-auth-block.ts --json /app/rows.json
 *   # sweep the retry spacing instead of using the default
 *   docker compose exec -T app npx tsx scripts/backtest-auth-block.ts --sweep
 */

import { readFileSync } from 'node:fs';
import {
	DEFAULT_BACKOFF_HOURS,
	decideAuthBlockRemedy,
	type RunOutcome
} from '$lib/import-tasks/failure-policy';
import { classifyLegacyErrorMessage, toFailureKind } from '$lib/import-tasks/failure-kinds';

const EXPORT_QUERY = `
SELECT r.search_task_id, r.id, r.status, r.error_message, r.failure_kind,
       r.triggered_by, r.started_at, r.finished_at,
       t.schedule_interval_hours, t.is_active
FROM search_task_runs r JOIN search_tasks t ON t.id = r.search_task_id
ORDER BY r.search_task_id, r.started_at`;

interface Row {
	search_task_id: number;
	id: number;
	status: string;
	error_message: string | null;
	failure_kind: string | null;
	triggered_by: string | null;
	started_at: string | Date;
	finished_at: string | Date | null;
	schedule_interval_hours: number | null;
	is_active: boolean | null;
}

if (process.argv.includes('--help')) {
	console.log(`Export rows from another environment with:\n\npsql -At -F$'\\t' -c "..."\n`);
	console.log(`Or as JSON:\n\npsql -At -c "SELECT json_agg(x) FROM (${EXPORT_QUERY.trim()}) x"\n`);
	process.exit(0);
}

async function loadRows(): Promise<Row[]> {
	const jsonFlag = process.argv.indexOf('--json');
	if (jsonFlag !== -1) {
		const path = process.argv[jsonFlag + 1];
		return JSON.parse(readFileSync(path, 'utf8')) as Row[];
	}
	const { dbDirect: db } = await import('$lib/server/db');
	const { search_task_runs, search_tasks } = await import('$lib/server/db/schema');
	const { asc, eq } = await import('drizzle-orm');
	return (await db
		.select({
			search_task_id: search_task_runs.search_task_id,
			id: search_task_runs.id,
			status: search_task_runs.status,
			error_message: search_task_runs.error_message,
			failure_kind: search_task_runs.failure_kind,
			triggered_by: search_task_runs.triggered_by,
			started_at: search_task_runs.started_at,
			finished_at: search_task_runs.finished_at,
			schedule_interval_hours: search_tasks.schedule_interval_hours,
			is_active: search_tasks.is_active
		})
		.from(search_task_runs)
		.innerJoin(search_tasks, eq(search_tasks.id, search_task_runs.search_task_id))
		.orderBy(asc(search_task_runs.search_task_id), asc(search_task_runs.started_at))) as Row[];
}

/** Chronological runs → the RunOutcome the policy wants, newest-first. */
function toOutcome(row: Row): RunOutcome {
	return {
		status: row.status,
		// Prefer a real stored kind; fall back to recovering one from the
		// message, which is what the backfill will have done by the time this
		// matters in production.
		failure_kind: toFailureKind(row.failure_kind) ?? classifyLegacyErrorMessage(row.error_message),
		triggered_by: row.triggered_by,
		started_at: new Date(row.started_at)
	};
}

function minutes(row: Row): number {
	if (!row.finished_at) return 0;
	return (new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()) / 60_000;
}

interface Episode {
	firedAt: Date;
	kind: string | null;
	streak: number;
	/** Scheduled runs that never happen while the task is backed off or off. */
	skippedFailures: number;
	skippedSuccesses: number;
	skippedMinutes: number;
	/** Set once the block outlived giveUpDays and the task was switched off. */
	disabledAt: Date | null;
	/** When a run got through and everything reset. */
	recoveredAt: Date | null;
}

interface TaskResult {
	taskId: number;
	eligible: boolean;
	episodes: Episode[];
	scheduledRuns: number;
}

/**
 * Walk one task's runs in order, applying the policy as it goes.
 *
 * `happened` is the history the policy sees, and it only contains runs that
 * would actually have taken place — feeding it the skipped ones would let the
 * simulation decide using evidence its own decision erased.
 */
function backtestTask(taskId: number, chronological: Row[], backoffHours: number): TaskResult {
	// A task with the schedule since removed still had one when these runs were
	// triggered, and the current column can't see that. Any scheduler-triggered
	// run in the history is the better evidence.
	const eligible =
		chronological.some((r) => r.schedule_interval_hours != null) ||
		chronological.some((r) => r.triggered_by === 'scheduler');
	const result: TaskResult = {
		taskId,
		eligible,
		episodes: [],
		scheduledRuns: chronological.filter((r) => r.triggered_by === 'scheduler').length
	};
	if (!eligible) return result;

	const happened: RunOutcome[] = [];
	let episode: Episode | null = null;
	let retryAfter: Date | null = null;
	let disabled = false;
	let notifiedAt: Date | null = null;

	for (const row of chronological) {
		const startedAt = new Date(row.started_at);
		const scheduled = row.triggered_by === 'scheduler';

		if (scheduled && episode && (disabled || (retryAfter && startedAt < retryAfter))) {
			if (row.status === 'error') episode.skippedFailures++;
			else if (row.status === 'success' || row.status === 'partial') {
				episode.skippedSuccesses++;
			}
			episode.skippedMinutes += minutes(row);
			continue;
		}

		happened.push(toOutcome(row));

		if (row.status === 'success' || row.status === 'partial') {
			if (episode) {
				episode.recoveredAt = startedAt;
				result.episodes.push(episode);
			}
			episode = null;
			retryAfter = null;
			disabled = false;
			notifiedAt = null;
			continue;
		}

		const remedy = decideAuthBlockRemedy([...happened].reverse(), {
			backoffHours,
			now: startedAt,
			notifiedAt
		});
		if (remedy.act === 'none') continue;

		episode ??= {
			firedAt: startedAt,
			kind: remedy.kind,
			streak: remedy.streak,
			skippedFailures: 0,
			skippedSuccesses: 0,
			skippedMinutes: 0,
			disabledAt: null,
			recoveredAt: null
		};
		if (remedy.notify) notifiedAt = startedAt;
		if (remedy.act === 'disable') {
			disabled = true;
			episode.disabledAt ??= startedAt;
		} else {
			retryAfter = new Date(startedAt.getTime() + remedy.retryInHours * 3_600_000);
		}
	}
	if (episode) result.episodes.push(episode);
	return result;
}

async function main() {
	const rows = await loadRows();
	const byTask = new Map<number, Row[]>();
	for (const row of rows) {
		const list = byTask.get(row.search_task_id) ?? [];
		list.push(row);
		byTask.set(row.search_task_id, list);
	}
	console.log(`Loaded ${rows.length} runs across ${byTask.size} tasks.\n`);

	const spacings = process.argv.includes('--sweep') ? [24, 48, 72, 168] : [DEFAULT_BACKOFF_HOURS];

	for (const backoffHours of spacings) {
		const results = [...byTask.entries()].map(([taskId, list]) =>
			backtestTask(taskId, list, backoffHours)
		);
		const flat = results
			.flatMap((r) => r.episodes.map((e) => ({ taskId: r.taskId, ...e })))
			.sort((a, b) => b.skippedFailures - a.skippedFailures);

		const savedFailures = flat.reduce((n, e) => n + e.skippedFailures, 0);
		const costSuccesses = flat.reduce((n, e) => n + e.skippedSuccesses, 0);
		const savedMinutes = flat.reduce((n, e) => n + e.skippedMinutes, 0);
		const scheduledRuns = results.reduce((n, r) => n + r.scheduledRuns, 0);
		const disables = flat.filter((e) => e.disabledAt).length;

		console.log('='.repeat(88));
		console.log(
			`retry spacing = ${backoffHours}h  ·  ${flat.length} block(s) across ` +
				`${results.filter((r) => r.episodes.length).length} task(s)  ·  ` +
				`${disables} switched off`
		);
		console.log('='.repeat(88));
		console.log(
			'  task   noticed      kind                streak  saved-fail  cost-ok   hours  recovered'
		);
		for (const e of flat) {
			console.log(
				`  ${String(e.taskId).padStart(4)}   ` +
					`${e.firedAt.toISOString().slice(0, 10)}   ` +
					`${(e.kind ?? '').padEnd(20)}` +
					`${String(e.streak).padStart(4)}    ` +
					`${String(e.skippedFailures).padStart(8)}  ` +
					`${String(e.skippedSuccesses).padStart(7)}  ` +
					`${(e.skippedMinutes / 60).toFixed(1).padStart(6)}  ` +
					`${e.recoveredAt ? e.recoveredAt.toISOString().slice(0, 10) : 'still blocked'}` +
					`${e.disabledAt ? `  (off ${e.disabledAt.toISOString().slice(0, 10)})` : ''}`
			);
		}
		const pct = scheduledRuns ? ((savedFailures / scheduledRuns) * 100).toFixed(1) : '0';
		console.log(
			`\n  ${savedFailures} of ${scheduledRuns} scheduled runs skipped (${pct}%), ` +
				`saving ${(savedMinutes / 60).toFixed(1)}h of queue time.`
		);
		console.log(
			`  Cost: ${costSuccesses} run(s) that would have succeeded were skipped ` +
				`— recoveries noticed late.`
		);
		console.log();
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
