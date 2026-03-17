/**
 * Tests for Scraper Queue
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAdd,
  mockGetActive,
  mockGetWaiting,
  mockGetWaitingCount,
  mockGetActiveCount,
  mockGetCompletedCount,
  mockGetFailedCount,
} = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockGetActive: vi.fn(),
  mockGetWaiting: vi.fn(),
  mockGetWaitingCount: vi.fn(),
  mockGetActiveCount: vi.fn(),
  mockGetCompletedCount: vi.fn(),
  mockGetFailedCount: vi.fn(),
}));

vi.mock("bullmq", () => {
  function MockQueue() {
    return {
      add: mockAdd,
      getActive: mockGetActive,
      getWaiting: mockGetWaiting,
      getWaitingCount: mockGetWaitingCount,
      getActiveCount: mockGetActiveCount,
      getCompletedCount: mockGetCompletedCount,
      getFailedCount: mockGetFailedCount,
    };
  }
  function MockQueueEvents() {
    return {};
  }
  return { Queue: MockQueue, QueueEvents: MockQueueEvents };
});

import {
  addScrapeJob,
  getActiveJobForSearch,
  getWaitingJobForSearch,
  removeWaitingJob,
  removeActiveJob,
  getQueueStats,
  type ScrapeJobData,
} from "../scraper-queue";

const jobData: ScrapeJobData = {
  searchTaskId: 42,
  runId: 7,
  searchUrl: "https://example.com/jobs",
  platformId: "linkedin",
  triggeredBy: "user",
};

describe("addScrapeJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds job with correct ID format", async () => {
    mockAdd.mockResolvedValueOnce({ id: "scrape-42-7" });
    await addScrapeJob(jobData);
    expect(mockAdd).toHaveBeenCalledWith("scrape", jobData, {
      jobId: "scrape-42-7",
      priority: undefined,
    });
  });

  it("passes priority option", async () => {
    mockAdd.mockResolvedValueOnce({});
    await addScrapeJob(jobData, { priority: 1 });
    expect(mockAdd).toHaveBeenCalledWith("scrape", jobData, {
      jobId: "scrape-42-7",
      priority: 1,
    });
  });
});

describe("getActiveJobForSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("finds active job by searchTaskId", async () => {
    const job = { data: { searchTaskId: 42 } };
    mockGetActive.mockResolvedValueOnce([
      { data: { searchTaskId: 10 } },
      job,
      { data: { searchTaskId: 99 } },
    ]);
    const result = await getActiveJobForSearch(42);
    expect(result).toBe(job);
  });

  it("returns undefined when no match", async () => {
    mockGetActive.mockResolvedValueOnce([
      { data: { searchTaskId: 10 } },
    ]);
    const result = await getActiveJobForSearch(42);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no active jobs", async () => {
    mockGetActive.mockResolvedValueOnce([]);
    const result = await getActiveJobForSearch(42);
    expect(result).toBeUndefined();
  });
});

describe("getWaitingJobForSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("finds waiting job by searchTaskId", async () => {
    const job = { data: { searchTaskId: 42 } };
    mockGetWaiting.mockResolvedValueOnce([job]);
    const result = await getWaitingJobForSearch(42);
    expect(result).toBe(job);
  });

  it("returns undefined when no match", async () => {
    mockGetWaiting.mockResolvedValueOnce([]);
    const result = await getWaitingJobForSearch(42);
    expect(result).toBeUndefined();
  });
});

describe("removeWaitingJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes waiting job and returns true", async () => {
    const mockRemove = vi.fn().mockResolvedValueOnce(undefined);
    mockGetWaiting.mockResolvedValueOnce([
      { data: { searchTaskId: 42 }, remove: mockRemove },
    ]);
    const result = await removeWaitingJob(42);
    expect(result).toBe(true);
    expect(mockRemove).toHaveBeenCalled();
  });

  it("returns false when no waiting job found", async () => {
    mockGetWaiting.mockResolvedValueOnce([]);
    const result = await removeWaitingJob(42);
    expect(result).toBe(false);
  });
});

describe("removeActiveJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves active job to failed and returns true", async () => {
    const mockMoveToFailed = vi.fn().mockResolvedValueOnce(undefined);
    mockGetActive.mockResolvedValueOnce([
      { data: { searchTaskId: 42 }, moveToFailed: mockMoveToFailed },
    ]);
    const result = await removeActiveJob(42);
    expect(result).toBe(true);
    expect(mockMoveToFailed).toHaveBeenCalledWith(
      expect.any(Error),
      "0",
      true,
    );
    expect(mockMoveToFailed.mock.calls[0][0].message).toBe("Cancelled by user");
  });

  it("returns false when no active job found", async () => {
    mockGetActive.mockResolvedValueOnce([]);
    const result = await removeActiveJob(42);
    expect(result).toBe(false);
  });
});

describe("getQueueStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all queue counts", async () => {
    mockGetWaitingCount.mockResolvedValueOnce(3);
    mockGetActiveCount.mockResolvedValueOnce(1);
    mockGetCompletedCount.mockResolvedValueOnce(50);
    mockGetFailedCount.mockResolvedValueOnce(2);

    const stats = await getQueueStats();
    expect(stats).toEqual({
      waiting: 3,
      active: 1,
      completed: 50,
      failed: 2,
    });
  });

  it("returns zeros when queue is empty", async () => {
    mockGetWaitingCount.mockResolvedValueOnce(0);
    mockGetActiveCount.mockResolvedValueOnce(0);
    mockGetCompletedCount.mockResolvedValueOnce(0);
    mockGetFailedCount.mockResolvedValueOnce(0);

    const stats = await getQueueStats();
    expect(stats).toEqual({ waiting: 0, active: 0, completed: 0, failed: 0 });
  });
});
