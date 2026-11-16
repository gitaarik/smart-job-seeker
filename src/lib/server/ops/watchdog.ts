/**
 * The operator's watchdog: looks at the things that break quietly and tells
 * someone. GlitchTip sees exceptions; it does not see a queue that stopped
 * moving, a run that has hung for three hours, every scheduled run failing on
 * our side, or the LLM bill heading for the daily cap. Those are what this
 * checks, every few minutes, from inside the worker.
 *
 * What it cannot see is itself: a dead worker, or a dead box, runs no
 * watchdog. That is /api/health's job, read by something outside (see
 * docs/OPS-MONITORING.md in sjs-ops, or any uptime pinger pointed at it).
 *
 * Three parts, kept apart so the rules can be tested without Redis or a
 * database:
 * - `collectSignals` reads the numbers;
 * - `evaluateSignals` turns numbers into firing alerts, pure;
 * - `Watchdog` remembers what has fired, so an alert goes out once when it
 *   starts, again every REMIND_MS while it lasts, and once when it clears.
 *   That memory is in process: a worker restart forgets it and re-announces
 *   whatever is still firing, once, which is the right failure.
 */

import { sql } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { db } from '$lib/server/db';
import { getEnv } from '$lib/tools/get-env';
import { config } from '$lib/server/config';
import { spentTodayUsd } from '$lib/server/llm/spend-limit';
import { getDesktopQueue, getFeedQueue } from '$lib/server/queue/scraper-queue';
import { getAtsBoardQueue } from '$lib/server/queue/ats-board-queue';
import { getCorpusMatchQueue } from '$lib/server/queue/corpus-match-queue';
import { getRescrapeQueue } from '$lib/server/queue/rescrape-queue';
import { getSearchFormProbeQueue } from '$lib/server/queue/search-form-probe-queue';
import { AUTH_SETUP_FAILURE_KINDS } from '$lib/import-tasks/failure-kinds';
import { sendOpsNotice, type OpsNotice } from './notify';

/** How often the worker runs a check. */
export const WATCHDOG_INTERVAL_MS = 5 * 60_000;

/** A still-firing alert is repeated this often. */
export const REMIND_MS = 6 * 60 * 60_000;

export interface QueueSignal {
	name: string;
	/** Jobs ready to run and not yet picked up (waiting + prioritized). */
	waiting: number;
	/** Age of the oldest of those, in minutes, or null when there are none. */
	oldestWaitingMin: number | null;
}

export interface Signals {
	queues: QueueSignal[];
	/** Runs still `running` past the stuck threshold. */
	stuckRuns: { count: number; oldestMin: number | null };
	/**
	 * Scheduled runs that finished inside the failure window. `ourFailures`
	 * leaves out the failures that are the user's to fix (sign-in problems)
	 * or nobody's (their device was off), which are not an operator alert.
	 */
	scheduledRuns: { finished: number; ourFailures: number; byKind: Record<string, number> };
	llm: { spentUsd: number; limitUsd: number };
}

export interface Thresholds {
	queueWaiting: number;
	queueAgeMin: number;
	stuckRunMin: number;
	failureWindowMin: number;
	failureMinCount: number;
	failureRate: number;
	llmSpendFraction: number;
}

function numberEnv(name: string, fallback: number): number {
	const n = Number(getEnv(name, String(fallback)));
	return Number.isFinite(n) ? n : fallback;
}

/**
 * Defaults, each overridable from the environment. The stuck-run line sits
 * well past the slowest run dev has seen (p99 and max both 34 minutes over 60
 * days, measured 2026-11-16).
 */
export function thresholdsFromEnv(): Thresholds {
	return {
		queueWaiting: numberEnv('SJS_ALERT_QUEUE_WAITING', 50),
		queueAgeMin: numberEnv('SJS_ALERT_QUEUE_AGE_MIN', 45),
		stuckRunMin: numberEnv('SJS_ALERT_STUCK_RUN_MIN', 90),
		failureWindowMin: numberEnv('SJS_ALERT_FAILURE_WINDOW_MIN', 180),
		failureMinCount: numberEnv('SJS_ALERT_FAILURE_MIN_COUNT', 3),
		failureRate: numberEnv('SJS_ALERT_FAILURE_RATE', 0.5),
		llmSpendFraction: numberEnv('SJS_ALERT_LLM_SPEND_FRACTION', 0.8)
	};
}

export interface FiringAlert {
	/** Stable identity: the same condition keeps the same key while it lasts. */
	key: string;
	summary: string;
	detail: string;
}

/** Failure kinds that are not ours to act on. */
const NOT_OUR_FAILURES: readonly string[] = [...AUTH_SETUP_FAILURE_KINDS, 'device_unavailable'];

export function evaluateSignals(s: Signals, t: Thresholds): FiringAlert[] {
	const alerts: FiringAlert[] = [];

	for (const q of s.queues) {
		if (q.waiting >= t.queueWaiting) {
			alerts.push({
				key: `queue-depth:${q.name}`,
				summary: `Queue ${q.name} has ${q.waiting} jobs waiting`,
				detail: `${q.waiting} waiting (alert at ${t.queueWaiting}). Is its worker running and picking jobs up?`
			});
		}
		if (q.oldestWaitingMin !== null && q.oldestWaitingMin >= t.queueAgeMin) {
			alerts.push({
				key: `queue-age:${q.name}`,
				summary: `Queue ${q.name}: oldest job waiting ${Math.round(q.oldestWaitingMin)} min`,
				detail: `The oldest ready job in ${q.name} has waited ${Math.round(q.oldestWaitingMin)} minutes (alert at ${t.queueAgeMin}). A hung run can hold a queue; check the active jobs.`
			});
		}
	}

	if (s.stuckRuns.count > 0) {
		alerts.push({
			key: 'stuck-runs',
			summary: `${s.stuckRuns.count} run(s) running over ${t.stuckRunMin} min`,
			detail: `${s.stuckRuns.count} search_task_runs row(s) still 'running' after ${t.stuckRunMin} minutes, the oldest for ${Math.round(s.stuckRuns.oldestMin ?? 0)} minutes. A hung run blocks its device's queue.`
		});
	}

	const { finished, ourFailures, byKind } = s.scheduledRuns;
	if (ourFailures >= t.failureMinCount && finished > 0 && ourFailures / finished >= t.failureRate) {
		const kinds = Object.entries(byKind)
			.sort((a, b) => b[1] - a[1])
			.map(([k, n]) => `${k}: ${n}`)
			.join(', ');
		alerts.push({
			key: 'scheduled-run-failures',
			summary: `${ourFailures} of ${finished} scheduled runs failed on our side`,
			detail: `In the last ${t.failureWindowMin} minutes, ${ourFailures} of ${finished} finished scheduled runs failed for a reason that is not the user's sign-in or an offline device. By kind: ${kinds || 'none recorded'}.`
		});
	}

	const { spentUsd, limitUsd } = s.llm;
	if (limitUsd > 0) {
		if (spentUsd >= limitUsd) {
			alerts.push({
				key: 'llm-spend-limit',
				summary: `LLM daily limit reached: $${spentUsd.toFixed(2)} of $${limitUsd.toFixed(2)}`,
				detail: `Every AI feature is refusing until 00:00 UTC (SJS_LLM_DAILY_LIMIT_USD). Find what spent it before raising the limit.`
			});
		} else if (spentUsd >= limitUsd * t.llmSpendFraction) {
			alerts.push({
				key: 'llm-spend-high',
				summary: `LLM spend at ${Math.round((spentUsd / limitUsd) * 100)}% of the daily limit`,
				detail: `$${spentUsd.toFixed(2)} of $${limitUsd.toFixed(2)} spent today (UTC). At the limit every AI feature stops until midnight UTC.`
			});
		}
	}

	return alerts;
}

/** The queues worth watching, by name. Built lazily: each opens a connection. */
function watchedQueues(): Array<[string, () => Queue]> {
	return [
		['scraper-desktop', getDesktopQueue],
		['feed-import', getFeedQueue],
		['ats-board', getAtsBoardQueue],
		['corpus-match', getCorpusMatchQueue],
		['rescrape', getRescrapeQueue],
		['search-form-probe', getSearchFormProbeQueue]
	] as Array<[string, () => Queue]>;
}

async function queueSignal(name: string, queue: Queue, now: number): Promise<QueueSignal> {
	const [waiting, oldestWait, oldestPrio] = await Promise.all([
		queue.getJobCountByTypes('waiting', 'prioritized'),
		queue.getJobs(['waiting'], 0, 0, true),
		queue.getJobs(['prioritized'], 0, 0, true)
	]);
	const stamps = [...oldestWait, ...oldestPrio]
		.map((j) => j?.timestamp)
		.filter((ts): ts is number => typeof ts === 'number');
	const oldest = stamps.length ? Math.min(...stamps) : null;
	return {
		name,
		waiting,
		oldestWaitingMin: oldest === null ? null : (now - oldest) / 60_000
	};
}

export async function collectSignals(t: Thresholds, now: number = Date.now()): Promise<Signals> {
	const queues = await Promise.all(
		watchedQueues().map(async ([name, get]) => {
			try {
				return await queueSignal(name, get(), now);
			} catch (err) {
				console.warn(`[Ops] Could not read queue ${name}:`, err);
				return { name, waiting: 0, oldestWaitingMin: null };
			}
		})
	);

	const stuck = await db.execute<{ count: string; oldest_min: string | null }>(sql`
		SELECT count(*) AS count,
		       EXTRACT(EPOCH FROM (now() - min(started_at))) / 60 AS oldest_min
		FROM search_task_runs
		WHERE status = 'running'
		  AND started_at < now() - make_interval(mins => ${t.stuckRunMin})
	`);

	const runs = await db.execute<{ failure_kind: string | null; status: string; n: string }>(sql`
		SELECT status, failure_kind, count(*) AS n
		FROM search_task_runs
		WHERE triggered_by = 'scheduler'
		  AND finished_at > now() - make_interval(mins => ${t.failureWindowMin})
		GROUP BY status, failure_kind
	`);

	let finished = 0;
	let ourFailures = 0;
	const byKind: Record<string, number> = {};
	for (const row of runs.rows) {
		const n = Number(row.n);
		finished += n;
		if (row.status !== 'error') continue;
		const kind = row.failure_kind ?? 'unknown';
		if (NOT_OUR_FAILURES.includes(kind)) continue;
		ourFailures += n;
		byKind[kind] = (byKind[kind] ?? 0) + n;
	}

	const stuckRow = stuck.rows[0];
	return {
		queues,
		stuckRuns: {
			count: Number(stuckRow?.count ?? 0),
			oldestMin: stuckRow?.oldest_min == null ? null : Number(stuckRow.oldest_min)
		},
		scheduledRuns: { finished, ourFailures, byKind },
		llm: { spentUsd: await spentTodayUsd(), limitUsd: config.llmDailyLimitUsd }
	};
}

/**
 * Turns the firing set of each check into notices: new, reminder, cleared.
 * `notify` is injectable for tests.
 */
export class Watchdog {
	/** key → when it was last announced. */
	private active = new Map<string, { alert: FiringAlert; lastSentAt: number }>();

	constructor(private readonly notify: (n: OpsNotice) => Promise<void> = sendOpsNotice) {}

	async apply(firing: FiringAlert[], now: number = Date.now()): Promise<void> {
		const seen = new Set<string>();
		for (const alert of firing) {
			seen.add(alert.key);
			const prev = this.active.get(alert.key);
			if (!prev) {
				this.active.set(alert.key, { alert, lastSentAt: now });
				await this.notify({ subject: alert.summary, body: alert.detail });
			} else if (now - prev.lastSentAt >= REMIND_MS) {
				this.active.set(alert.key, { alert, lastSentAt: now });
				await this.notify({ subject: `Still: ${alert.summary}`, body: alert.detail });
			} else {
				prev.alert = alert;
			}
		}
		for (const [key, { alert }] of this.active) {
			if (seen.has(key)) continue;
			this.active.delete(key);
			await this.notify({
				subject: `Cleared: ${alert.summary}`,
				body: 'This condition is no longer firing.'
			});
		}
	}

	/** Keys currently firing, for logs and tests. */
	firing(): string[] {
		return [...this.active.keys()];
	}

	/** One full check: read, evaluate, notify. */
	async check(t: Thresholds = thresholdsFromEnv()): Promise<void> {
		const signals = await collectSignals(t);
		await this.apply(evaluateSignals(signals, t));
	}
}
