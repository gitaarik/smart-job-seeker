/**
 * Platform-Discovery Queue
 *
 * Admin-only BullMQ queue for the "go find out what this job site's URLs
 * look like" workflow. One concurrency slot — discovery runs are infrequent
 * and the LLM analysis is cheap-but-not-free, so no need to parallelise.
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './connection.js';

export interface SearchFormProbeJobData {
	discoveryRunId: number;
	/** Front-page URL of the job platform being discovered. */
	targetUrl: string;
	/** User-id of the admin who triggered this run. */
	triggeredByUserId: string | null;
}

export interface SearchFormProbeJobResult {
	ok: boolean;
}

const defaultJobOptions = {
	removeOnComplete: 50,
	removeOnFail: 200,
	attempts: 1
};

let _q: Queue<SearchFormProbeJobData, SearchFormProbeJobResult> | null = null;
let _qe: QueueEvents | null = null;

export function getSearchFormProbeQueue() {
	return (_q ??= new Queue('search-form-probe', {
		connection: redisConnection,
		defaultJobOptions
	}));
}

export function getSearchFormProbeQueueEvents() {
	return (_qe ??= new QueueEvents('search-form-probe', {
		connection: redisConnection
	}));
}

export async function addSearchFormProbeJob(data: SearchFormProbeJobData) {
	const queue = getSearchFormProbeQueue();
	const jobId = `discovery-${data.discoveryRunId}`;
	return queue.add('discover', data, { jobId });
}
