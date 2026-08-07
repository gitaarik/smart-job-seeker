/**
 * Match Job Queue
 *
 * BullMQ queue for on-demand job matching requests (e.g. re-match button).
 * The cloud worker processes these jobs using calculateMatch.
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './connection';

// ============================================================================
// Types
// ============================================================================

export interface MatchJobData {
	profileId: number;
	jobId: number;
	triggeredBy: 'user' | 'system';
}

export interface MatchJobResult {
	score: number;
	recommendation: string;
}

// ============================================================================
// Queue Instance
// ============================================================================

// Lazy singletons — avoids Redis connection at import/build time
let _matchQueue: Queue<MatchJobData, MatchJobResult> | null = null;
let _matchQueueEvents: QueueEvents | null = null;

function getMatchQueue() {
	return (_matchQueue ??= new Queue('matcher', {
		connection: redisConnection,
		defaultJobOptions: {
			removeOnComplete: 100,
			removeOnFail: 500,
			attempts: 1
		}
	}));
}

function getMatchQueueEvents() {
	return (_matchQueueEvents ??= new QueueEvents('matcher', {
		connection: redisConnection
	}));
}

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
	timeoutMs: number = 60_000
): Promise<MatchJobResult> {
	// Use a unique job ID with timestamp to avoid BullMQ deduplication.
	// A fixed ID like "match-1-617" would silently return the old completed job
	// instead of creating a new one (since removeOnComplete keeps them around).
	const jobId = `match-${data.profileId}-${data.jobId}-${Date.now()}`;
	const queue = getMatchQueue();
	const job = await queue.add('match', data, { jobId });
	const result = await job.waitUntilFinished(getMatchQueueEvents(), timeoutMs);
	return result;
}

/**
 * Fire-and-forget enqueue. Use when the caller (e.g. the import path) just
 * wants to schedule a match without blocking the request on the LLM call.
 * Swallows enqueue errors so a Redis hiccup doesn't break the import — the
 * background matcher loop will pick the job up on its next cycle.
 */
export async function enqueueMatchJob(data: MatchJobData): Promise<void> {
	const jobId = `match-${data.profileId}-${data.jobId}-${Date.now()}`;
	try {
		await getMatchQueue().add('match', data, { jobId });
	} catch (err) {
		console.warn(
			`[match-queue] enqueue failed for profile=${data.profileId} job=${data.jobId}:`,
			err
		);
	}
}
