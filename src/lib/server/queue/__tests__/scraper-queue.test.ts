/**
 * Tests for Scraper Queue (dual hosted/desktop queues)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Each Queue instance gets its own set of mocks (hoisted for vi.mock access)
const { hostedMocks, desktopMocks } = vi.hoisted(() => {
  const makeMocks = () => ({
    add: vi.fn(),
    getActive: vi.fn().mockResolvedValue([]),
    getWaiting: vi.fn().mockResolvedValue([]),
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getCompletedCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
  });
  return { hostedMocks: makeMocks(), desktopMocks: makeMocks() };
});

vi.mock("bullmq", () => {
  function MockQueue(name: string) {
    if (name === "scraper-hosted") return hostedMocks;
    if (name === "scraper-desktop") return desktopMocks;
    return hostedMocks;
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default resolved values
    hostedMocks.getActive.mockResolvedValue([]);
    hostedMocks.getWaiting.mockResolvedValue([]);
    desktopMocks.getActive.mockResolvedValue([]);
    desktopMocks.getWaiting.mockResolvedValue([]);
  });

  it("routes hosted provider to hosted queue", async () => {
    hostedMocks.add.mockResolvedValueOnce({ id: "scrape-42-7" });
    await addScrapeJob({ ...jobData, browserProvider: "hosted" });
    expect(hostedMocks.add).toHaveBeenCalledWith(
      "scrape",
      { ...jobData, browserProvider: "hosted" },
      { jobId: "scrape-42-7", priority: undefined },
    );
    expect(desktopMocks.add).not.toHaveBeenCalled();
  });

  it("routes null provider to desktop queue", async () => {
    desktopMocks.add.mockResolvedValueOnce({ id: "scrape-42-7" });
    await addScrapeJob(jobData);
    expect(desktopMocks.add).toHaveBeenCalledWith(
      "scrape",
      jobData,
      { jobId: "scrape-42-7", priority: undefined },
    );
    expect(hostedMocks.add).not.toHaveBeenCalled();
  });

  it("routes 'local' provider to desktop queue", async () => {
    desktopMocks.add.mockResolvedValueOnce({ id: "scrape-42-7" });
    await addScrapeJob({ ...jobData, browserProvider: "local" });
    expect(desktopMocks.add).toHaveBeenCalled();
    expect(hostedMocks.add).not.toHaveBeenCalled();
  });

  it("passes priority option", async () => {
    desktopMocks.add.mockResolvedValueOnce({});
    await addScrapeJob(jobData, { priority: 1 });
    expect(desktopMocks.add).toHaveBeenCalledWith("scrape", jobData, {
      jobId: "scrape-42-7",
      priority: 1,
    });
  });
});

describe("getActiveJobForSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostedMocks.getActive.mockResolvedValue([]);
    hostedMocks.getWaiting.mockResolvedValue([]);
    desktopMocks.getActive.mockResolvedValue([]);
    desktopMocks.getWaiting.mockResolvedValue([]);
  });

  it("finds active job in hosted queue", async () => {
    const job = { data: { searchTaskId: 42 } };
    hostedMocks.getActive.mockResolvedValueOnce([job]);
    desktopMocks.getActive.mockResolvedValueOnce([]);
    const result = await getActiveJobForSearch(42);
    expect(result).toBe(job);
  });

  it("finds active job in desktop queue", async () => {
    const job = { data: { searchTaskId: 42 } };
    hostedMocks.getActive.mockResolvedValueOnce([]);
    desktopMocks.getActive.mockResolvedValueOnce([job]);
    const result = await getActiveJobForSearch(42);
    expect(result).toBe(job);
  });

  it("returns undefined when no match in either queue", async () => {
    hostedMocks.getActive.mockResolvedValueOnce([{ data: { searchTaskId: 10 } }]);
    desktopMocks.getActive.mockResolvedValueOnce([{ data: { searchTaskId: 20 } }]);
    const result = await getActiveJobForSearch(42);
    expect(result).toBeUndefined();
  });

  it("returns undefined when both queues are empty", async () => {
    hostedMocks.getActive.mockResolvedValueOnce([]);
    desktopMocks.getActive.mockResolvedValueOnce([]);
    const result = await getActiveJobForSearch(42);
    expect(result).toBeUndefined();
  });
});

describe("getWaitingJobForSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostedMocks.getActive.mockResolvedValue([]);
    hostedMocks.getWaiting.mockResolvedValue([]);
    desktopMocks.getActive.mockResolvedValue([]);
    desktopMocks.getWaiting.mockResolvedValue([]);
  });

  it("finds waiting job in desktop queue", async () => {
    const job = { data: { searchTaskId: 42 } };
    hostedMocks.getWaiting.mockResolvedValueOnce([]);
    desktopMocks.getWaiting.mockResolvedValueOnce([job]);
    const result = await getWaitingJobForSearch(42);
    expect(result).toBe(job);
  });

  it("returns undefined when no match", async () => {
    hostedMocks.getWaiting.mockResolvedValueOnce([]);
    desktopMocks.getWaiting.mockResolvedValueOnce([]);
    const result = await getWaitingJobForSearch(42);
    expect(result).toBeUndefined();
  });
});

describe("removeWaitingJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostedMocks.getActive.mockResolvedValue([]);
    hostedMocks.getWaiting.mockResolvedValue([]);
    desktopMocks.getActive.mockResolvedValue([]);
    desktopMocks.getWaiting.mockResolvedValue([]);
  });

  it("removes waiting job and returns true", async () => {
    const mockRemove = vi.fn().mockResolvedValueOnce(undefined);
    hostedMocks.getWaiting.mockResolvedValueOnce([]);
    desktopMocks.getWaiting.mockResolvedValueOnce([
      { data: { searchTaskId: 42 }, remove: mockRemove },
    ]);
    const result = await removeWaitingJob(42);
    expect(result).toBe(true);
    expect(mockRemove).toHaveBeenCalled();
  });

  it("returns false when no waiting job found", async () => {
    hostedMocks.getWaiting.mockResolvedValueOnce([]);
    desktopMocks.getWaiting.mockResolvedValueOnce([]);
    const result = await removeWaitingJob(42);
    expect(result).toBe(false);
  });
});

describe("removeActiveJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostedMocks.getActive.mockResolvedValue([]);
    hostedMocks.getWaiting.mockResolvedValue([]);
    desktopMocks.getActive.mockResolvedValue([]);
    desktopMocks.getWaiting.mockResolvedValue([]);
  });

  it("moves active job to failed and returns true", async () => {
    const mockMoveToFailed = vi.fn().mockResolvedValueOnce(undefined);
    hostedMocks.getActive.mockResolvedValueOnce([
      { data: { searchTaskId: 42 }, moveToFailed: mockMoveToFailed },
    ]);
    desktopMocks.getActive.mockResolvedValueOnce([]);
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
    hostedMocks.getActive.mockResolvedValueOnce([]);
    desktopMocks.getActive.mockResolvedValueOnce([]);
    const result = await removeActiveJob(42);
    expect(result).toBe(false);
  });
});

describe("getQueueStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated counts from both queues", async () => {
    hostedMocks.getWaitingCount.mockResolvedValueOnce(2);
    hostedMocks.getActiveCount.mockResolvedValueOnce(1);
    hostedMocks.getCompletedCount.mockResolvedValueOnce(30);
    hostedMocks.getFailedCount.mockResolvedValueOnce(1);
    desktopMocks.getWaitingCount.mockResolvedValueOnce(1);
    desktopMocks.getActiveCount.mockResolvedValueOnce(0);
    desktopMocks.getCompletedCount.mockResolvedValueOnce(20);
    desktopMocks.getFailedCount.mockResolvedValueOnce(1);

    const stats = await getQueueStats();
    expect(stats).toEqual({
      waiting: 3,
      active: 1,
      completed: 50,
      failed: 2,
      hosted: { waiting: 2, active: 1, completed: 30, failed: 1 },
      desktop: { waiting: 1, active: 0, completed: 20, failed: 1 },
    });
  });

  it("returns zeros when both queues are empty", async () => {
    hostedMocks.getWaitingCount.mockResolvedValueOnce(0);
    hostedMocks.getActiveCount.mockResolvedValueOnce(0);
    hostedMocks.getCompletedCount.mockResolvedValueOnce(0);
    hostedMocks.getFailedCount.mockResolvedValueOnce(0);
    desktopMocks.getWaitingCount.mockResolvedValueOnce(0);
    desktopMocks.getActiveCount.mockResolvedValueOnce(0);
    desktopMocks.getCompletedCount.mockResolvedValueOnce(0);
    desktopMocks.getFailedCount.mockResolvedValueOnce(0);

    const stats = await getQueueStats();
    expect(stats).toEqual({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      hosted: { waiting: 0, active: 0, completed: 0, failed: 0 },
      desktop: { waiting: 0, active: 0, completed: 0, failed: 0 },
    });
  });
});
