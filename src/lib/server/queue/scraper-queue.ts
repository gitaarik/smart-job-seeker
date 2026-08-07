/**
 * Scraper Job Queues
 *
 * Two separate BullMQ queues for parallel scraping:
 * - "scraper-hosted" — cloud/GoLogin browser sessions
 * - "scraper-desktop" — desktop app tunnel (user's local Chrome)
 *
 * Each queue has concurrency:1 (one browser at a time per provider),
 * but they run independently so a hosted and desktop scrape can
 * execute simultaneously.
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
	/** Which queue to route to. Null/undefined uses server default. */
	browserProvider?: string | null;
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
let _hostedQ: Queue<ScrapeJobData, ScrapeJobResult> | null = null;
let _desktopQ: Queue<ScrapeJobData, ScrapeJobResult> | null = null;
let _hostedQE: QueueEvents | null = null;
let _desktopQE: QueueEvents | null = null;

function getHostedQueue() {
	return (_hostedQ ??= new Queue('scraper-hosted', {
		connection: redisConnection,
		defaultJobOptions
	}));
}
function getDesktopQueue() {
	return (_desktopQ ??= new Queue('scraper-desktop', {
		connection: redisConnection,
		defaultJobOptions
	}));
}
function getHostedQueueEvents() {
	return (_hostedQE ??= new QueueEvents('scraper-hosted', { connection: redisConnection }));
}
function getDesktopQueueEvents() {
	return (_desktopQE ??= new QueueEvents('scraper-desktop', { connection: redisConnection }));
}

// Re-export getters for the barrel export (cloud worker uses these)
export { getHostedQueue, getDesktopQueue, getHostedQueueEvents, getDesktopQueueEvents };

// ============================================================================
// Queue Routing
// ============================================================================

/**
 * Resolve which queue a job should go to based on the browser provider.
 *
 * "hosted" → hosted queue (GoLogin cloud browser)
 * Everything else (null, "tunnel") → desktop queue
 */
function resolveQueue(browserProvider?: string | null): Queue<ScrapeJobData, ScrapeJobResult> {
	if (browserProvider === 'hosted') return getHostedQueue();
	return getDesktopQueue();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add a scrape job to the appropriate queue based on browserProvider
 */
export async function addScrapeJob(data: ScrapeJobData, options?: { priority?: number }) {
	const queue = resolveQueue(data.browserProvider);
	const jobId = `scrape-${data.searchTaskId}-${data.runId}`;
	return queue.add('scrape', data, {
		jobId,
		priority: options?.priority
	});
}

/**
 * Get the active job for a job search (if any) — searches both queues
 */
export async function getActiveJobForSearch(searchTaskId: number) {
	const activeJobArrays = await Promise.all(
		[getHostedQueue(), getDesktopQueue()].map((q) => q.getActive())
	);
	return activeJobArrays.flat().find((j) => j.data.searchTaskId === searchTaskId);
}

/**
 * Get waiting job for a job search (if any) — searches both queues
 */
export async function getWaitingJobForSearch(searchTaskId: number) {
	const waitingJobArrays = await Promise.all(
		[getHostedQueue(), getDesktopQueue()].map((q) => q.getWaiting())
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
	queue: 'hosted' | 'desktop';
	state: 'active' | 'waiting';
	searchTaskId: number;
	runId: number;
}

/**
 * List all active + waiting scrape jobs across both queues. Used by the admin
 * reconcile action to detect drift between the queues and the DB.
 */
export async function listQueueJobs(): Promise<QueuedScrapeJob[]> {
	const queues: Array<['hosted' | 'desktop', Queue<ScrapeJobData, ScrapeJobResult>]> = [
		['hosted', getHostedQueue()],
		['desktop', getDesktopQueue()]
	];
	const result: QueuedScrapeJob[] = [];
	for (const [name, q] of queues) {
		const [active, waiting] = await Promise.all([q.getActive(), q.getWaiting()]);
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
	for (const q of [getHostedQueue(), getDesktopQueue()]) {
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
 * Get aggregate queue stats across both queues
 */
export async function getQueueStats() {
	const hosted = getHostedQueue();
	const desktop = getDesktopQueue();
	const [
		hostedWaiting,
		hostedActive,
		hostedCompleted,
		hostedFailed,
		desktopWaiting,
		desktopActive,
		desktopCompleted,
		desktopFailed
	] = await Promise.all([
		hosted.getWaitingCount(),
		hosted.getActiveCount(),
		hosted.getCompletedCount(),
		hosted.getFailedCount(),
		desktop.getWaitingCount(),
		desktop.getActiveCount(),
		desktop.getCompletedCount(),
		desktop.getFailedCount()
	]);

	return {
		waiting: hostedWaiting + desktopWaiting,
		active: hostedActive + desktopActive,
		completed: hostedCompleted + desktopCompleted,
		failed: hostedFailed + desktopFailed,
		hosted: {
			waiting: hostedWaiting,
			active: hostedActive,
			completed: hostedCompleted,
			failed: hostedFailed
		},
		desktop: {
			waiting: desktopWaiting,
			active: desktopActive,
			completed: desktopCompleted,
			failed: desktopFailed
		}
	};
}
