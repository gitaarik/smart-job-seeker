/**
 * Debug API — Queue Inspector
 *
 * GET /api/debug/queue
 *
 * Snapshot of the task queue and run state. Useful for spotting stuck
 * runs, orphaned items, BullMQ↔DB drift, dead workers, and rescrape
 * leftovers — anything that wouldn't show up in /api/debug/run/:id
 * because it isn't tied to a single run.
 *
 * Protected by DEBUG_API_KEY (Bearer token). Not session-authenticated —
 * designed for machine-to-machine access from the dev server.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Job } from 'bullmq';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { jobs, scraper_logs, search_task_run_items, search_task_runs } from '$lib/server/db/schema';
import { getDesktopQueue, getHostedQueue, getQueueStats } from '$lib/server/queue/scraper-queue';
import { getRedisClient } from '$lib/server/queue/redis';
import { getAllMatcherStates, isMatcherAlive } from '$lib/server/job/matcher-state';

const ACTIVE_RUN_STATUSES = ['pending', 'queued', 'running', 'blocked', 'stopping'] as const;
const TERMINAL_RUN_STATUSES = ['success', 'error', 'cancelled', 'partial'] as const;
const ACTIVE_ITEM_STATUSES = ['pending', 'processing'] as const;
const STUCK_STOPPING_THRESHOLD_S = 120;

function requireDebugAuth(request: Request): void {
	const key = process.env.DEBUG_API_KEY;
	if (!key) throw error(503, 'Debug API not configured');
	const auth = request.headers.get('authorization');
	if (!auth || auth !== `Bearer ${key}`) {
		throw error(401, 'Invalid or missing debug API key');
	}
}

function detectEnvironment(): string {
	const origin = process.env.ORIGIN || '';
	if (origin.includes('preview.')) return 'preview';
	if (origin.includes('www.')) return 'production';
	if (origin.includes('dev.')) return 'development';
	return 'development';
}

function summarizeJob(j: Job, now: number) {
	const startedAt = j.processedOn ?? j.timestamp;
	return {
		id: j.id,
		name: j.name,
		data: j.data,
		attemptsMade: j.attemptsMade,
		addedAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
		processedOn: j.processedOn ? new Date(j.processedOn).toISOString() : null,
		ageSeconds: startedAt ? Math.floor((now - startedAt) / 1000) : null,
		failedReason: j.failedReason ?? null
	};
}

async function pingRedis() {
	try {
		const redis = getRedisClient();
		const [pong, dbsize] = await Promise.all([redis.ping(), redis.dbsize()]);
		return { connected: pong === 'PONG', dbsize };
	} catch (err) {
		return { connected: false, error: (err as Error).message };
	}
}

export const GET: RequestHandler = async ({ request }) => {
	requireDebugAuth(request);

	const hostedQ = getHostedQueue();
	const desktopQ = getDesktopQueue();

	const [
		queueStats,
		hostedActive,
		hostedWaiting,
		desktopActive,
		desktopWaiting,
		matcherAlive,
		matcherStates,
		activeRuns,
		orphanedItems,
		rescrapeOrphans,
		recentErrorLogs,
		redisInfo
	] = await Promise.all([
		getQueueStats(),
		hostedQ.getActive(),
		hostedQ.getWaiting(),
		desktopQ.getActive(),
		desktopQ.getWaiting(),
		isMatcherAlive(),
		getAllMatcherStates(),
		db.query.search_task_runs.findMany({
			where: inArray(search_task_runs.status, [...ACTIVE_RUN_STATUSES]),
			orderBy: desc(search_task_runs.started_at),
			columns: {
				id: true,
				search_task_id: true,
				status: true,
				started_at: true,
				bullmq_job_id: true,
				triggered_by: true,
				error_message: true
			},
			limit: 100
		}),
		db
			.select({
				itemId: search_task_run_items.id,
				runId: search_task_run_items.run_id,
				itemStatus: search_task_run_items.status,
				itemTitle: search_task_run_items.title,
				runStatus: search_task_runs.status,
				runFinishedAt: search_task_runs.finished_at
			})
			.from(search_task_run_items)
			.innerJoin(search_task_runs, eq(search_task_runs.id, search_task_run_items.run_id))
			.where(
				and(
					inArray(search_task_run_items.status, [...ACTIVE_ITEM_STATUSES]),
					inArray(search_task_runs.status, [...TERMINAL_RUN_STATUSES])
				)
			)
			.orderBy(desc(search_task_run_items.id))
			.limit(100),
		db.query.jobs.findMany({
			where: inArray(jobs.rescrape_status, ['scraping', 'queued']),
			orderBy: desc(jobs.date_updated),
			columns: {
				id: true,
				title: true,
				rescrape_status: true,
				rescrape_message: true,
				date_updated: true
			},
			limit: 50
		}),
		db.query.scraper_logs.findMany({
			where: eq(scraper_logs.level, 'error'),
			orderBy: desc(scraper_logs.timestamp),
			columns: {
				run_id: true,
				level: true,
				message: true,
				timestamp: true
			},
			limit: 30
		}),
		pingRedis()
	]);

	const now = Date.now();

	const allActive = [...hostedActive, ...desktopActive];
	const activeBullIds = new Set(allActive.map((j) => j.id).filter(Boolean) as string[]);
	const activeBullSearchIds = new Set(
		allActive.map((j) => j.data?.searchTaskId).filter((v) => v != null)
	);

	// DB says active, BullMQ has no matching job (likely orphan from worker crash)
	const runsWithoutBullJob = activeRuns.filter((r) => {
		if (r.status === 'pending') return false; // not yet queued is fine
		if (r.bullmq_job_id && activeBullIds.has(r.bullmq_job_id)) return false;
		if (activeBullSearchIds.has(r.search_task_id)) return false;
		return true;
	});

	// BullMQ active, but the DB run for that job ID isn't in an active state
	const dbActiveRunIds = new Set(
		activeRuns.map((r) => r.bullmq_job_id).filter(Boolean) as string[]
	);
	const orphanedBullJobs = allActive
		.filter((j) => j.id && !dbActiveRunIds.has(j.id))
		.map((j) => summarizeJob(j, now));

	const stuckStopping = activeRuns
		.filter((r) => r.status === 'stopping')
		.map((r) => ({
			...r,
			ageSeconds: r.started_at ? Math.floor((now - r.started_at.getTime()) / 1000) : null
		}))
		.filter((r) => (r.ageSeconds ?? 0) > STUCK_STOPPING_THRESHOLD_S);

	const activeRunsWithAge = activeRuns.map((r) => ({
		...r,
		ageSeconds: r.started_at ? Math.floor((now - r.started_at.getTime()) / 1000) : null
	}));

	return json({
		environment: detectEnvironment(),
		timestamp: new Date().toISOString(),
		queues: {
			stats: queueStats,
			hosted: {
				active: hostedActive.map((j) => summarizeJob(j, now)),
				waiting: hostedWaiting.map((j) => summarizeJob(j, now))
			},
			desktop: {
				active: desktopActive.map((j) => summarizeJob(j, now)),
				waiting: desktopWaiting.map((j) => summarizeJob(j, now))
			}
		},
		matcher: {
			alive: matcherAlive,
			states: matcherStates
		},
		activeRuns: activeRunsWithAge,
		stuckStopping,
		orphanedItems,
		rescrapeOrphans,
		recentErrorLogs,
		drift: {
			runsWithoutBullJob,
			orphanedBullJobs
		},
		redis: redisInfo
	});
};
