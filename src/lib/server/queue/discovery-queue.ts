/**
 * Platform-Discovery Queue
 *
 * Admin-only BullMQ queue for the "go find out what this job site's URLs
 * look like" workflow. One concurrency slot — discovery runs are infrequent
 * and the LLM analysis is cheap-but-not-free, so no need to parallelise.
 */

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./connection.js";

export interface DiscoveryJobData {
  discoveryRunId: number;
  /** Front-page URL of the job platform being discovered. */
  targetUrl: string;
  /** User-id of the admin who triggered this run. */
  triggeredByUserId: string | null;
}

export interface DiscoveryJobResult {
  ok: boolean;
}

const defaultJobOptions = {
  removeOnComplete: 50,
  removeOnFail: 200,
  attempts: 1,
};

let _q: Queue<DiscoveryJobData, DiscoveryJobResult> | null = null;
let _qe: QueueEvents | null = null;

export function getDiscoveryQueue() {
  return (_q ??= new Queue("platform-discovery", {
    connection: redisConnection,
    defaultJobOptions,
  }));
}

export function getDiscoveryQueueEvents() {
  return (_qe ??= new QueueEvents("platform-discovery", {
    connection: redisConnection,
  }));
}

export async function addDiscoveryJob(data: DiscoveryJobData) {
  const queue = getDiscoveryQueue();
  const jobId = `discovery-${data.discoveryRunId}`;
  return queue.add("discover", data, { jobId });
}
