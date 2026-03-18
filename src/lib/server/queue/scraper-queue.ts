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

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./connection";

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
  triggeredBy: "user" | "scheduler";
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
  attempts: 1, // No auto-retry for scraper jobs (they handle retries internally)
};

export const hostedScraperQueue = new Queue<ScrapeJobData, ScrapeJobResult>(
  "scraper-hosted",
  { connection: redisConnection, defaultJobOptions },
);

export const desktopScraperQueue = new Queue<ScrapeJobData, ScrapeJobResult>(
  "scraper-desktop",
  { connection: redisConnection, defaultJobOptions },
);

/** Both queues for cross-queue lookups */
const allScraperQueues = [hostedScraperQueue, desktopScraperQueue];

// ============================================================================
// Queue Events (for monitoring)
// ============================================================================

export const hostedScraperQueueEvents = new QueueEvents("scraper-hosted", {
  connection: redisConnection,
});

export const desktopScraperQueueEvents = new QueueEvents("scraper-desktop", {
  connection: redisConnection,
});

// ============================================================================
// Queue Routing
// ============================================================================

/**
 * Resolve which queue a job should go to based on the browser provider.
 *
 * "hosted" → hosted queue (GoLogin cloud browser)
 * Everything else (null, "local", "tunnel") → desktop queue
 */
function resolveQueue(
  browserProvider?: string | null,
): Queue<ScrapeJobData, ScrapeJobResult> {
  if (browserProvider === "hosted") return hostedScraperQueue;
  return desktopScraperQueue;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add a scrape job to the appropriate queue based on browserProvider
 */
export async function addScrapeJob(
  data: ScrapeJobData,
  options?: { priority?: number },
) {
  const queue = resolveQueue(data.browserProvider);
  const jobId = `scrape-${data.searchTaskId}-${data.runId}`;
  return queue.add("scrape", data, {
    jobId,
    priority: options?.priority,
  });
}

/**
 * Get the active job for a job search (if any) — searches both queues
 */
export async function getActiveJobForSearch(searchTaskId: number) {
  const activeJobArrays = await Promise.all(
    allScraperQueues.map((q) => q.getActive()),
  );
  return activeJobArrays
    .flat()
    .find((j) => j.data.searchTaskId === searchTaskId);
}

/**
 * Get waiting job for a job search (if any) — searches both queues
 */
export async function getWaitingJobForSearch(searchTaskId: number) {
  const waitingJobArrays = await Promise.all(
    allScraperQueues.map((q) => q.getWaiting()),
  );
  return waitingJobArrays
    .flat()
    .find((j) => j.data.searchTaskId === searchTaskId);
}

/**
 * Remove a waiting job from the queue (whichever queue it's in)
 */
export async function removeWaitingJob(
  searchTaskId: number,
): Promise<boolean> {
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
export async function removeActiveJob(
  searchTaskId: number,
): Promise<boolean> {
  const activeJob = await getActiveJobForSearch(searchTaskId);
  if (activeJob) {
    await activeJob.moveToFailed(
      new Error("Cancelled by user"),
      "0",
      true,
    );
    return true;
  }
  return false;
}

/**
 * Get aggregate queue stats across both queues
 */
export async function getQueueStats() {
  const [
    hostedWaiting,
    hostedActive,
    hostedCompleted,
    hostedFailed,
    desktopWaiting,
    desktopActive,
    desktopCompleted,
    desktopFailed,
  ] = await Promise.all([
    hostedScraperQueue.getWaitingCount(),
    hostedScraperQueue.getActiveCount(),
    hostedScraperQueue.getCompletedCount(),
    hostedScraperQueue.getFailedCount(),
    desktopScraperQueue.getWaitingCount(),
    desktopScraperQueue.getActiveCount(),
    desktopScraperQueue.getCompletedCount(),
    desktopScraperQueue.getFailedCount(),
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
      failed: hostedFailed,
    },
    desktop: {
      waiting: desktopWaiting,
      active: desktopActive,
      completed: desktopCompleted,
      failed: desktopFailed,
    },
  };
}
