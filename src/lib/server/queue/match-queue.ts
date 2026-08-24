/**
 * Match Job Queue
 *
 * BullMQ queue for on-demand job matching requests (e.g. re-match button).
 * The cloud worker processes these jobs using calculateMatch.
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './connection';
import { errorTracker } from '$lib/server/monitoring/error-tracker';

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
	if (!_matchQueue) {
		_matchQueue = new Queue<MatchJobData, MatchJobResult>('matcher', {
			connection: redisConnection,
			defaultJobOptions: {
				removeOnComplete: 100,
				removeOnFail: 500,
				attempts: 1
			}
		});
		// An EventEmitter with no 'error' listener rethrows what it emits, so a
		// Redis hiccup here would take the server down rather than fail one match.
		_matchQueue.on('error', (err) => console.warn('[match-queue] queue error:', err));
	}
	return _matchQueue;
}

function getMatchQueueEvents() {
	if (!_matchQueueEvents) {
		_matchQueueEvents = new QueueEvents('matcher', {
			connection: redisConnection
		});
		_matchQueueEvents.on('error', (err) => console.warn('[match-queue] queue events error:', err));
	}
	return _matchQueueEvents;
}

/**
 * Drop the QueueEvents singleton so the next wait builds a fresh one.
 *
 * Closing it interrupts any other request still waiting on the same stream —
 * which is the point: that stream is not delivering, and each of those waits
 * has the same poll fallback to land on.
 */
function recycleMatchQueueEvents(stale: QueueEvents) {
	// Another request may have recycled it already; only drop what we waited on.
	if (_matchQueueEvents === stale) {
		_matchQueueEvents = null;
	}
	stale
		.close()
		.catch((err) => console.warn('[match-queue] closing the stale queue events failed:', err));
}

// ============================================================================
// Waiting for a result
// ============================================================================

/** How often the fallback re-reads the job's own state from Redis. */
const POLL_INTERVAL_MS = 1_000;

type WaitOutcome =
	| { via: 'event' | 'poll'; ok: true; result: MatchJobResult }
	| { via: 'event' | 'poll'; ok: false; error: Error };

const toError = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)));

/**
 * Watch the job's own record in Redis until it reaches a terminal state.
 *
 * This is the floor under `waitUntilFinished`. That call hears about the job
 * only through the QueueEvents stream, and when that stream's Redis client
 * dies BullMQ cannot tell: `waitUntilReady()` still resolves (it awaits the
 * original connect, which succeeded long ago) and the consume loop's blocking
 * XREAD rejects into a retry that classes "Connection is closed." as a
 * connection error and swallows it. The result is a wait that can only ever
 * end in the timeout, with the score already sitting in the database. Ordinary
 * reads are unaffected by that, so they still answer.
 *
 * Resolves null when it stops without an answer — which only happens once the
 * event path has settled the race, since `until` deliberately runs a beat past
 * that path's timeout.
 */
async function pollUntilFinished(
	queue: Queue<MatchJobData, MatchJobResult>,
	jobId: string,
	until: number,
	abandoned: () => boolean
): Promise<WaitOutcome | null> {
	while (Date.now() < until) {
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
		if (abandoned()) break;
		try {
			const fresh = await queue.getJob(jobId);
			if (!fresh) continue;
			const state = await fresh.getState();
			if (state === 'completed') {
				return { via: 'poll', ok: true, result: fresh.returnvalue };
			}
			if (state === 'failed') {
				return {
					via: 'poll',
					ok: false,
					error: new Error(fresh.failedReason || 'Match job failed')
				};
			}
		} catch {
			// A read that failed is not an answer — keep polling until the deadline.
		}
	}
	return null;
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

	const events = getMatchQueueEvents();
	const startedAt = Date.now();
	let settled = false;

	// Fast path: the completion event, normally milliseconds after the worker
	// finishes. It keeps the ttl even though the poll below could time out on
	// its own, because the ttl is also what unregisters the two listeners this
	// call adds to a QueueEvents singleton that outlives the request.
	const viaEvent: Promise<WaitOutcome> = job
		.waitUntilFinished(events, timeoutMs)
		.then((result): WaitOutcome => ({ via: 'event', ok: true, result }))
		.catch((err): WaitOutcome => ({ via: 'event', ok: false, error: toError(err) }));

	const viaPoll = pollUntilFinished(
		queue,
		jobId,
		startedAt + timeoutMs + POLL_INTERVAL_MS,
		() => settled
	);

	const outcome = await Promise.race([viaEvent, viaPoll]);
	settled = true;

	// Only reachable if the event path's timer runs late enough for the poll to
	// give up first; its own timeout normally lands a beat earlier and wins.
	if (!outcome) {
		throw new Error(`Match job ${jobId} did not finish within ${timeoutMs}ms`);
	}

	if (outcome.via === 'poll') {
		// The job reached a terminal state and no event arrived: this stream is
		// dead in the way described on pollUntilFinished. Report it — being
		// silent is the whole problem — and drop it so the next wait gets a live
		// one instead of failing the same way for the rest of the process's life.
		const waitedMs = Date.now() - startedAt;
		errorTracker.logError(
			'Match completion event never arrived; recycling the QueueEvents stream',
			new Error(`No completion event for ${jobId} after ${waitedMs}ms`),
			{
				operation: 'match-queue.addMatchJob',
				metadata: {
					bullmqJobId: jobId,
					profileId: data.profileId,
					jobId: data.jobId,
					waitedMs
				}
			}
		);
		recycleMatchQueueEvents(events);
	}

	if (!outcome.ok) {
		throw outcome.error;
	}
	return outcome.result;
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
