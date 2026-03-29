/**
 * Single Job Rescrape Queue
 *
 * BullMQ queue for re-scraping individual jobs by ID.
 * Used when a user wants to refresh job data from the source URL.
 */

import { Queue } from "bullmq";
import { redisConnection } from "./connection";

// ============================================================================
// Types
// ============================================================================

export interface RescrapeJobData {
  jobId: number;
  sourceUrl: string;
  platformId: number;
  triggeredBy: "user";
  /** Browser session overrides (same fields as normal scraper) */
  countryCode?: string;
  browserLanguage?: string;
  browserTimezone?: string;
  credentialId?: number;
  browserProvider?: string;
  keepMinimized?: boolean;
  rescrapeRunId?: number;
}

export interface RescrapeJobResult {
  success: boolean;
  message: string;
}

// ============================================================================
// Queue Instance
// ============================================================================

export const rescrapeQueue = new Queue<RescrapeJobData, RescrapeJobResult>(
  "rescrape",
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: 1,
    },
  },
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add a rescrape job to the queue
 */
export async function addRescrapeJob(data: RescrapeJobData) {
  const queueJobId = `rescrape-${data.jobId}-${Date.now()}`;
  return rescrapeQueue.add("rescrape", data, {
    jobId: queueJobId,
  });
}

/**
 * Get the active rescrape job for a specific job ID (if any)
 */
export async function getActiveRescrapeJob(jobId: number) {
  const activeJobs = await rescrapeQueue.getActive();
  return activeJobs.find((j) => j.data.jobId === jobId);
}

/**
 * Get waiting rescrape job for a specific job ID (if any)
 */
export async function getWaitingRescrapeJob(jobId: number) {
  const waitingJobs = await rescrapeQueue.getWaiting();
  return waitingJobs.find((j) => j.data.jobId === jobId);
}

/**
 * Check if a job is currently being rescraped or queued for rescrape
 */
export async function isJobRescraping(jobId: number): Promise<boolean> {
  const [active, waiting] = await Promise.all([
    getActiveRescrapeJob(jobId),
    getWaitingRescrapeJob(jobId),
  ]);
  return !!(active || waiting);
}

/**
 * Remove a waiting rescrape job from the queue.
 * Returns true if a job was found and removed.
 */
export async function removeWaitingRescrapeJob(
  jobId: number,
): Promise<boolean> {
  const waitingJob = await getWaitingRescrapeJob(jobId);
  if (waitingJob) {
    await waitingJob.remove();
    return true;
  }
  return false;
}

/**
 * Force-fail and remove an active rescrape job from the queue.
 * Used when cancelling a running rescrape.
 */
export async function removeActiveRescrapeJob(
  jobId: number,
): Promise<boolean> {
  const activeJob = await getActiveRescrapeJob(jobId);
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
