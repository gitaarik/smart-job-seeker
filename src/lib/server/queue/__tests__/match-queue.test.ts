/**
 * Tests for the Match Queue's wait path.
 *
 * The interesting behaviour is what happens when the QueueEvents stream stops
 * delivering: the job still finishes, and the wait has to notice by reading
 * Redis rather than hanging until the timeout. See match-queue.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchJobResult } from '../match-queue';

const mocks = vi.hoisted(() => ({
	add: vi.fn(),
	getJob: vi.fn(),
	waitUntilFinished: vi.fn(),
	queues: [] as { on: ReturnType<typeof vi.fn> }[],
	queueEvents: [] as { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }[],
	logError: vi.fn()
}));

vi.mock('bullmq', () => {
	function MockQueue() {
		const queue = {
			add: (...args: unknown[]) => mocks.add(...args),
			getJob: (...args: unknown[]) => mocks.getJob(...args),
			on: vi.fn()
		};
		mocks.queues.push(queue);
		return queue;
	}
	function MockQueueEvents() {
		const events = { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
		mocks.queueEvents.push(events);
		return events;
	}
	return { Queue: MockQueue, QueueEvents: MockQueueEvents };
});

vi.mock('$lib/server/monitoring/error-tracker', () => ({
	errorTracker: { logError: (...args: unknown[]) => mocks.logError(...args) }
}));

const RESULT: MatchJobResult = { score: 58, recommendation: 'consider' };

/** A promise that never settles — a QueueEvents stream that is not delivering. */
const silent = () => new Promise<never>(() => {});

/** Fresh module per test: the queue/events singletons live at module scope. */
async function loadMatchQueue() {
	vi.resetModules();
	return await import('../match-queue');
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.queues.length = 0;
	mocks.queueEvents.length = 0;
	mocks.add.mockImplementation(async () => ({
		waitUntilFinished: (...args: unknown[]) => mocks.waitUntilFinished(...args)
	}));
	mocks.getJob.mockResolvedValue(undefined);
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('addMatchJob', () => {
	it('returns the result from the completion event, without polling', async () => {
		const { addMatchJob } = await loadMatchQueue();
		mocks.waitUntilFinished.mockResolvedValue(RESULT);

		await expect(addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' })).resolves.toEqual(
			RESULT
		);

		expect(mocks.getJob).not.toHaveBeenCalled();
		expect(mocks.queueEvents[0].close).not.toHaveBeenCalled();
		// The wait is still bounded by the caller's timeout.
		expect(mocks.waitUntilFinished).toHaveBeenCalledWith(expect.anything(), 60_000);
	});

	it('reads the result from Redis when no completion event arrives', async () => {
		const { addMatchJob } = await loadMatchQueue();
		mocks.waitUntilFinished.mockReturnValue(silent());
		mocks.getJob.mockResolvedValue({
			getState: async () => 'completed',
			returnvalue: RESULT
		});

		const pending = addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' });
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(pending).resolves.toEqual(RESULT);
	});

	it('recycles the dead stream so the next wait gets a fresh one', async () => {
		const { addMatchJob } = await loadMatchQueue();
		mocks.waitUntilFinished.mockReturnValue(silent());
		mocks.getJob.mockResolvedValue({
			getState: async () => 'completed',
			returnvalue: RESULT
		});

		const first = addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' });
		await vi.advanceTimersByTimeAsync(1_000);
		await first;

		expect(mocks.queueEvents).toHaveLength(1);
		expect(mocks.queueEvents[0].close).toHaveBeenCalled();
		// A silent stream is exactly what went unnoticed before, so it is reported.
		expect(mocks.logError).toHaveBeenCalledWith(
			expect.stringContaining('never arrived'),
			expect.any(Error),
			expect.objectContaining({
				metadata: expect.objectContaining({ profileId: 1, jobId: 4492 })
			})
		);

		// The second wait must not reuse the stream that just failed to deliver.
		mocks.waitUntilFinished.mockResolvedValue(RESULT);
		await addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' });
		expect(mocks.queueEvents).toHaveLength(2);
	});

	it('surfaces a job failure found by polling', async () => {
		const { addMatchJob } = await loadMatchQueue();
		mocks.waitUntilFinished.mockReturnValue(silent());
		mocks.getJob.mockResolvedValue({
			getState: async () => 'failed',
			failedReason: 'No matching config found for profile 1'
		});

		const pending = addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' });
		// Attach the rejection handler before letting the poll run, or the
		// rejection lands with nothing listening and Vitest flags it.
		const assertion = expect(pending).rejects.toThrow('No matching config found for profile 1');
		await vi.advanceTimersByTimeAsync(1_000);
		await assertion;
	});

	it('keeps waiting while the job is still running, and times out if it never finishes', async () => {
		const { addMatchJob } = await loadMatchQueue();
		mocks.waitUntilFinished.mockImplementation(
			(_events: unknown, ttl: number) =>
				new Promise((_resolve, reject) => {
					setTimeout(() => reject(new Error(`Job wait match timed out ... after ${ttl}ms`)), ttl);
				})
		);
		mocks.getJob.mockResolvedValue({ getState: async () => 'active' });

		const pending = addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' }, 5_000);
		const assertion = expect(pending).rejects.toThrow('timed out');
		await vi.advanceTimersByTimeAsync(5_000);
		await assertion;

		// It polled every second rather than giving up on the first non-terminal read.
		expect(mocks.getJob).toHaveBeenCalledTimes(4);
	});

	it('keeps polling when a read fails', async () => {
		const { addMatchJob } = await loadMatchQueue();
		mocks.waitUntilFinished.mockReturnValue(silent());
		mocks.getJob
			.mockRejectedValueOnce(new Error('Connection is closed.'))
			.mockResolvedValue({ getState: async () => 'completed', returnvalue: RESULT });

		const pending = addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' });
		await vi.advanceTimersByTimeAsync(2_000);

		await expect(pending).resolves.toEqual(RESULT);
	});

	it('listens for errors on both singletons', async () => {
		const { addMatchJob } = await loadMatchQueue();
		mocks.waitUntilFinished.mockResolvedValue(RESULT);

		await addMatchJob({ profileId: 1, jobId: 4492, triggeredBy: 'user' });

		expect(mocks.queues[0].on).toHaveBeenCalledWith('error', expect.any(Function));
		expect(mocks.queueEvents[0].on).toHaveBeenCalledWith('error', expect.any(Function));
	});
});
