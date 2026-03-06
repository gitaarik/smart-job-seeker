/**
 * Match Job Queue
 *
 * BullMQ queue for on-demand job matching requests (e.g. re-match button).
 * The cloud worker processes these jobs using calculateMatch.
 */

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./connection";

// ============================================================================
// Types
// ============================================================================

export interface MatchJobData {
  profileId: number;
  jobId: number;
  triggeredBy: "user" | "system";
}

export interface MatchJobResult {
  score: number;
  recommendation: string;
}

// ============================================================================
// Queue Instance
// ============================================================================

export const matchQueue = new Queue<MatchJobData, MatchJobResult>(
  "matcher",
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 1,
    },
  },
);

const matchQueueEvents = new QueueEvents("matcher", {
  connection: redisConnection,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add a match job to the queue and wait for it to complete.
 * Returns the match result (score + recommendation).
 * Throws if the job fails or times out.
 */
export async function addMatchJob(
  data: MatchJobData,
  timeoutMs: number = 60_000,
): Promise<MatchJobResult> {
  const jobId = `match-${data.profileId}-${data.jobId}`;
  const job = await matchQueue.add("match", data, { jobId });
  const result = await job.waitUntilFinished(matchQueueEvents, timeoutMs);
  return result;
}
