/**
 * ATS board queue
 *
 * One BullMQ job per career-site board to sweep (`ats_boards`): fetch the
 * board's public feed, upsert its postings into `ats_postings`, record its
 * health. The worker in cloud processes the queue three boards at a time with
 * a per-provider gap, and fills it nightly; the admin page and, later, the
 * add-a-board flow put single boards or a whole provider on it with
 * "sweep now". See planning/ATS-FEEDS.md.
 *
 * Two job kinds share the queue. A `board` job sweeps one board. A `sweep`
 * job is a request to fill the queue with every board of a provider (or of
 * all of them); the worker handles it, because the free-space guard and the
 * prune that come before a sweep run on the worker's disk and database, and
 * the app should not have a second copy of those rules.
 */

import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export type AtsBoardJobData =
	| {
			kind: 'board';
			boardId: number;
			provider: string;
			triggeredBy: 'sweep' | 'admin' | 'user';
			/** Set on the one retry a throttled board gets within a sweep. */
			retry?: boolean;
	  }
	| {
			kind: 'sweep';
			/** One provider, or null for every provider. */
			provider: string | null;
			triggeredBy: 'admin';
	  };

export interface AtsBoardJobResult {
	kind: string;
	/** Boards put on the queue by a `sweep` job; the outcome kind for a `board` job. */
	detail: string;
}

export const ATS_BOARD_QUEUE = 'ats-board';

const defaultJobOptions = {
	// A board's result lives on its row; the job has nothing to keep. Removing
	// it on completion also frees its id, so the same board can be queued again
	// tomorrow (BullMQ ignores an add whose id still exists).
	removeOnComplete: true,
	removeOnFail: 100,
	attempts: 1
};

let _q: Queue<AtsBoardJobData, AtsBoardJobResult> | null = null;

export function getAtsBoardQueue() {
	return (_q ??= new Queue(ATS_BOARD_QUEUE, {
		connection: redisConnection,
		defaultJobOptions
	}));
}

/** The job id for a board, so one board is on the queue at most once at a time. */
export function atsBoardJobId(boardId: number, retry = false) {
	return `board-${boardId}${retry ? '-retry' : ''}`;
}

/** Queue one board; a no-op when that board is already waiting. */
export async function enqueueAtsBoard(
	board: { id: number; provider: string },
	triggeredBy: 'sweep' | 'admin' | 'user',
	opts: { retry?: boolean; delayMs?: number } = {}
) {
	const q = getAtsBoardQueue();
	return q.add(
		'board',
		{ kind: 'board', boardId: board.id, provider: board.provider, triggeredBy, retry: opts.retry },
		{ jobId: atsBoardJobId(board.id, opts.retry), delay: opts.delayMs }
	);
}

/** Queue many boards in one round trip; boards already waiting are skipped by BullMQ. */
export async function enqueueAtsBoards(
	boards: { id: number; provider: string }[],
	triggeredBy: 'sweep' | 'admin' | 'user'
) {
	if (!boards.length) return 0;
	const q = getAtsBoardQueue();
	await q.addBulk(
		boards.map((b) => ({
			name: 'board',
			data: { kind: 'board' as const, boardId: b.id, provider: b.provider, triggeredBy },
			opts: { jobId: atsBoardJobId(b.id) }
		}))
	);
	return boards.length;
}

/** Ask the worker to sweep a provider, or all of them, now. */
export async function enqueueAtsSweep(provider: string | null) {
	const q = getAtsBoardQueue();
	return q.add(
		'sweep',
		{ kind: 'sweep', provider, triggeredBy: 'admin' },
		{ jobId: `sweep-${provider ?? 'all'}-${Date.now()}` }
	);
}

export interface AtsBoardQueueStats {
	waiting: number;
	active: number;
	delayed: number;
	failed: number;
}

export async function getAtsBoardQueueStats(): Promise<AtsBoardQueueStats> {
	const q = getAtsBoardQueue();
	const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
	return {
		waiting: counts.waiting ?? 0,
		active: counts.active ?? 0,
		delayed: counts.delayed ?? 0,
		failed: counts.failed ?? 0
	};
}

/** Drop failed jobs so their ids no longer block the boards they were for. */
export async function clearFailedAtsBoardJobs(): Promise<number> {
	const q = getAtsBoardQueue();
	const removed = await q.clean(0, 10_000, 'failed');
	return removed.length;
}
