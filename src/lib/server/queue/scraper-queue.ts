/**
 * Scraper Job Queue
 *
 * BullMQ queue for managing scraper jobs with:
 * - Job scheduling (cron)
 * - Cancellation support
 * - Per-run tracking
 */

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./connection";

// ============================================================================
// Types
// ============================================================================

export interface ScrapeJobData {
  jobSearchId: number;
  runId: number;
  searchUrl: string;
  platformId: string;
  useVision?: boolean;
  searchTerm?: string;
  triggeredBy: "user" | "scheduler";
}

export interface ScrapeJobResult {
  jobsProcessed: number;
}

// ============================================================================
// Queue Instance
// ============================================================================

export const scraperQueue = new Queue<ScrapeJobData, ScrapeJobResult>(
  "scraper",
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 1, // No auto-retry for scraper jobs (they handle retries internally)
    },
  },
);

// ============================================================================
// Queue Events (for monitoring)
// ============================================================================

export const scraperQueueEvents = new QueueEvents("scraper", {
  connection: redisConnection,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add a scrape job to the queue
 */
export async function addScrapeJob(
  data: ScrapeJobData,
  options?: { priority?: number },
) {
  const jobId = `scrape-${data.jobSearchId}-${data.runId}`;
  return scraperQueue.add("scrape", data, {
    jobId,
    priority: options?.priority,
  });
}

/**
 * Get the active job for a job search (if any)
 */
export async function getActiveJobForSearch(jobSearchId: number) {
  const activeJobs = await scraperQueue.getActive();
  return activeJobs.find((j) => j.data.jobSearchId === jobSearchId);
}

/**
 * Get waiting job for a job search (if any)
 */
export async function getWaitingJobForSearch(jobSearchId: number) {
  const waitingJobs = await scraperQueue.getWaiting();
  return waitingJobs.find((j) => j.data.jobSearchId === jobSearchId);
}

/**
 * Remove a waiting job from the queue
 */
export async function removeWaitingJob(jobSearchId: number): Promise<boolean> {
  const waitingJob = await getWaitingJobForSearch(jobSearchId);
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
  jobSearchId: number,
): Promise<boolean> {
  const activeJob = await getActiveJobForSearch(jobSearchId);
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
 * Get queue stats
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getCompletedCount(),
    scraperQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
