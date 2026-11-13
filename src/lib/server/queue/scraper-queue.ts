/**
 * Scraper Job Queues
 *
 * Two separate BullMQ queues:
 * - "scraper-desktop" — browser scrapes: the user's own device over the
 *   tunnel, or on dev the local Docker Chrome
 * - "feed-import" — no browser: a search task on a feed platform
 *   (`job_platforms.fetch_mode = 'feed'`) queries the ATS corpus the worker
 *   sweeps (planning/ATS-FEEDS.md) and promotes its hits into jobs
 *
 * They run independently, so a feed import never waits behind a browser
 * scrape.
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './connection.js';

// ============================================================================
// Types
// ============================================================================

export interface ScrapeJobData {
	searchTaskId: number;
	runId: number;
	searchUrl: string;
	platformId: string;
	useVision?: boolean;
	searchTerm?: string;
	triggeredBy: 'user' | 'scheduler' | 'scraper-agent';
	/** The task's browser provider. Null/undefined uses the server default. */
	browserProvider?: string | null;
	/** The platform's `fetch_mode`; `feed` routes to the feed-import queue, no browser. */
	fetchMode?: 'browser' | 'feed' | null;
}

export interface ScrapeJobResult {
	jobsProcessed: number;
}

// ============================================================================
// Queue Instances
// ============================================================================

const defaultJobOptions = {
	removeOnComplete: 100,
	removeOnFail: 500,
	attempts: 1 // No auto-retry for scraper jobs (they handle retries internally)
};

// Lazy singletons — avoids Redis connection at import/build time
let _desktopQ: Queue<ScrapeJobData, ScrapeJobResult> | null = null;
let _feedQ: Queue<ScrapeJobData, ScrapeJobResult> | null = null;
let _desktopQE: QueueEvents | null = null;

function getDesktopQueue() {
	return (_desktopQ ??= new Queue('scraper-desktop', {
		connection: redisConnection,
		defaultJobOptions
	}));
}
function getFeedQueue() {
	return (_feedQ ??= new Queue('feed-import', {
		connection: redisConnection,
		defaultJobOptions
	}));
}
function getDesktopQueueEvents() {
	return (_desktopQE ??= new QueueEvents('scraper-desktop', { connection: redisConnection }));
}

// Re-export getters for the barrel export (cloud worker uses these)
export { getDesktopQueue, getFeedQueue, getDesktopQueueEvents };

/** Every scrape queue, for the lookups that must not care which one a job is on. */
function allQueues() {
	return [getDesktopQueue(), getFeedQueue()];
}

// ============================================================================
// Queue Routing
// ============================================================================

/**
 * Resolve which queue a job should go to. A feed platform's run needs no
 * browser and goes to the feed queue; every browser run (null, "tunnel",
 * "local") goes to the desktop queue.
 */
function resolveQueue(fetchMode?: string | null): Queue<ScrapeJobData, ScrapeJobResult> {
	if (fetchMode === 'feed') return getFeedQueue();
	return getDesktopQueue();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add a scrape job to the appropriate queue based on the platform's fetch mode
 */
export async function addScrapeJob(data: ScrapeJobData, options?: { priority?: number }) {
	const queue = resolveQueue(data.fetchMode);
	const jobId = `scrape-${data.searchTaskId}-${data.runId}`;
	return queue.add('scrape', data, {
		jobId,
		priority: options?.priority
	});
}

/**
 * Get the active job for a job search (if any) — searches every queue
 */
export async function getActiveJobForSearch(searchTaskId: number) {
	const activeJobArrays = await Promise.all(allQueues().map((q) => q.getActive()));
	return activeJobArrays.flat().find((j) => j.data.searchTaskId === searchTaskId);
}

/**
 * The states a job can wait in. `delayed` is not only a scheduled job: the
 * desktop worker parks a run there while another run holds its device
 * (cloud `device-lease.ts`), and such a run is still queued, not lost.
 */
const PENDING_STATES = ['waiting', 'delayed', 'prioritized'] as const;

/**
 * Get the pending job for a job search (if any) — searches every queue
 */
export async function getWaitingJobForSearch(searchTaskId: number) {
	const waitingJobArrays = await Promise.all(
		allQueues().map((q) => q.getJobs([...PENDING_STATES]))
	);
	return waitingJobArrays.flat().find((j) => j.data.searchTaskId === searchTaskId);
}

/**
 * Remove a waiting job from the queue (whichever queue it's in)
 */
export async function removeWaitingJob(searchTaskId: number): Promise<boolean> {
	const waitingJob = await getWaitingJobForSearch(searchTaskId);
	if (waitingJob) {
		await waitingJob.remove();
		return true;
	}
	return false;
}

/**
 * Force-fail and remove an active job from the queue.
 * Used when cancelling a running scrape or cleaning up stale jobs.
 */
export async function removeActiveJob(searchTaskId: number): Promise<boolean> {
	const activeJob = await getActiveJobForSearch(searchTaskId);
	if (activeJob) {
		await activeJob.moveToFailed(new Error('Cancelled by user'), '0', true);
		return true;
	}
	return false;
}

/**
 * A scrape job currently present in one of the queues, with the identifiers
 * needed to reconcile it against the DB.
 */
export interface QueuedScrapeJob {
	jobId: string;
	queue: 'desktop' | 'feed';
	state: 'active' | 'waiting';
	searchTaskId: number;
	runId: number;
}

/**
 * List all active + waiting scrape jobs across every queue. Used by the admin
 * reconcile action to detect drift between the queues and the DB.
 */
export async function listQueueJobs(): Promise<QueuedScrapeJob[]> {
	const queues: Array<['desktop' | 'feed', Queue<ScrapeJobData, ScrapeJobResult>]> = [
		['desktop', getDesktopQueue()],
		['feed', getFeedQueue()]
	];
	const result: QueuedScrapeJob[] = [];
	for (const [name, q] of queues) {
		const [active, waiting] = await Promise.all([q.getActive(), q.getJobs([...PENDING_STATES])]);
		for (const [state, jobs] of [
			['active', active],
			['waiting', waiting]
		] as const) {
			for (const j of jobs) {
				if (!j.id) continue;
				result.push({
					jobId: j.id,
					queue: name,
					state,
					searchTaskId: j.data.searchTaskId,
					runId: j.data.runId
				});
			}
		}
	}
	return result;
}

/**
 * Force-fail and remove a specific job by its BullMQ job id, regardless of
 * which queue it lives in or whether it is active or waiting. Returns true if
 * a job was found and removed.
 */
export async function removeJobById(jobId: string): Promise<boolean> {
	for (const q of allQueues()) {
		const job = await q.getJob(jobId);
		if (!job) continue;
		const state = await job.getState();
		if (state === 'active') {
			await job.moveToFailed(new Error('Cleared by admin reconcile'), '0', true);
		} else {
			await job.remove();
		}
		return true;
	}
	return false;
}

/**
 * Get queue stats for the browser scrape queue
 */
export async function getQueueStats() {
	const desktop = getDesktopQueue();
	const [waiting, active, completed, failed] = await Promise.all([
		desktop.getJobCountByTypes(...PENDING_STATES),
		desktop.getActiveCount(),
		desktop.getCompletedCount(),
		desktop.getFailedCount()
	]);

	return {
		waiting,
		active,
		completed,
		failed,
		desktop: { waiting, active, completed, failed }
	};
}
