/**
 * Tests for Rescrape Queue
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAdd, mockGetActive, mockGetWaiting } = vi.hoisted(() => ({
	mockAdd: vi.fn(),
	mockGetActive: vi.fn(),
	mockGetWaiting: vi.fn()
}));

vi.mock('bullmq', () => {
	function MockQueue() {
		return {
			add: mockAdd,
			getActive: mockGetActive,
			getWaiting: mockGetWaiting
		};
	}
	return { Queue: MockQueue };
});

import {
	addRescrapeJob,
	getActiveRescrapeJob,
	getWaitingRescrapeJob,
	isJobRescraping,
	type RescrapeJobData
} from '../rescrape-queue';

const jobData: RescrapeJobData = {
	jobId: 123,
	sourceUrl: 'https://example.com/jobs/123',
	platformId: 5,
	triggeredBy: 'user'
};

describe('addRescrapeJob', () => {
	beforeEach(() => vi.clearAllMocks());

	it('adds job with ID containing jobId and timestamp', async () => {
		mockAdd.mockResolvedValueOnce({});
		await addRescrapeJob(jobData);
		expect(mockAdd).toHaveBeenCalledWith('rescrape', jobData, {
			jobId: expect.stringMatching(/^rescrape-123-\d+$/)
		});
	});

	it('generates unique job IDs', async () => {
		mockAdd.mockResolvedValue({});
		await addRescrapeJob(jobData);
		const firstId = mockAdd.mock.calls[0][2].jobId;

		await new Promise((r) => setTimeout(r, 5));
		await addRescrapeJob(jobData);
		const secondId = mockAdd.mock.calls[1][2].jobId;

		expect(firstId).not.toBe(secondId);
	});
});

describe('getActiveRescrapeJob', () => {
	beforeEach(() => vi.clearAllMocks());

	it('finds active job by jobId', async () => {
		const job = { data: { jobId: 123 } };
		mockGetActive.mockResolvedValueOnce([{ data: { jobId: 456 } }, job]);
		const result = await getActiveRescrapeJob(123);
		expect(result).toBe(job);
	});

	it('returns undefined when no match', async () => {
		mockGetActive.mockResolvedValueOnce([{ data: { jobId: 456 } }]);
		const result = await getActiveRescrapeJob(123);
		expect(result).toBeUndefined();
	});
});

describe('getWaitingRescrapeJob', () => {
	beforeEach(() => vi.clearAllMocks());

	it('finds waiting job by jobId', async () => {
		const job = { data: { jobId: 123 } };
		mockGetWaiting.mockResolvedValueOnce([job]);
		const result = await getWaitingRescrapeJob(123);
		expect(result).toBe(job);
	});

	it('returns undefined when no match', async () => {
		mockGetWaiting.mockResolvedValueOnce([]);
		const result = await getWaitingRescrapeJob(123);
		expect(result).toBeUndefined();
	});
});

describe('isJobRescraping', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns true when job is active', async () => {
		mockGetActive.mockResolvedValueOnce([{ data: { jobId: 123 } }]);
		mockGetWaiting.mockResolvedValueOnce([]);
		expect(await isJobRescraping(123)).toBe(true);
	});

	it('returns true when job is waiting', async () => {
		mockGetActive.mockResolvedValueOnce([]);
		mockGetWaiting.mockResolvedValueOnce([{ data: { jobId: 123 } }]);
		expect(await isJobRescraping(123)).toBe(true);
	});

	it('returns true when job is both active and waiting', async () => {
		mockGetActive.mockResolvedValueOnce([{ data: { jobId: 123 } }]);
		mockGetWaiting.mockResolvedValueOnce([{ data: { jobId: 123 } }]);
		expect(await isJobRescraping(123)).toBe(true);
	});

	it('returns false when job is neither active nor waiting', async () => {
		mockGetActive.mockResolvedValueOnce([]);
		mockGetWaiting.mockResolvedValueOnce([]);
		expect(await isJobRescraping(123)).toBe(false);
	});

	it('returns false when different jobs are active', async () => {
		mockGetActive.mockResolvedValueOnce([{ data: { jobId: 456 } }]);
		mockGetWaiting.mockResolvedValueOnce([{ data: { jobId: 789 } }]);
		expect(await isJobRescraping(123)).toBe(false);
	});
});
