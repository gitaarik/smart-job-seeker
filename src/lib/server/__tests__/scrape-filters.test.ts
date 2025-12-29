import { describe, expect, it } from "vitest";
import {
  checkStopConditions,
  isJobClosed,
  isJobTooOld,
  type ScrapingStats,
} from "../scrape-filters";

describe("checkStopConditions", () => {
  it("should stop when hard limit reached", () => {
    const stats: ScrapingStats = {
      jobsProcessed: 100,
      consecutiveClosedJobs: 0,
      jobsSkippedOld: 0,
      jobsSkippedClosed: 0,
    };

    const result = checkStopConditions(stats, {
      maxJobsPerSearch: 100,
      consecutiveClosedLimit: 5,
    });

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toContain("Hard limit");
    expect(result.reason).toContain("100/100");
  });

  it("should stop when consecutive closed limit reached", () => {
    const stats: ScrapingStats = {
      jobsProcessed: 50,
      consecutiveClosedJobs: 5,
      jobsSkippedOld: 0,
      jobsSkippedClosed: 5,
    };

    const result = checkStopConditions(stats, {
      maxJobsPerSearch: 100,
      consecutiveClosedLimit: 5,
    });

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toContain("5 consecutive closed jobs");
  });

  it("should not stop when limits not reached", () => {
    const stats: ScrapingStats = {
      jobsProcessed: 50,
      consecutiveClosedJobs: 3,
      jobsSkippedOld: 10,
      jobsSkippedClosed: 5,
    };

    const result = checkStopConditions(stats, {
      maxJobsPerSearch: 100,
      consecutiveClosedLimit: 5,
    });

    expect(result.shouldStop).toBe(false);
    expect(result.reason).toBe("");
  });

  it("should prioritize hard limit over consecutive closed", () => {
    const stats: ScrapingStats = {
      jobsProcessed: 100,
      consecutiveClosedJobs: 10,
      jobsSkippedOld: 0,
      jobsSkippedClosed: 10,
    };

    const result = checkStopConditions(stats, {
      maxJobsPerSearch: 100,
      consecutiveClosedLimit: 5,
    });

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toContain("Hard limit");
  });

  it("should handle edge case at exactly the limit", () => {
    const stats: ScrapingStats = {
      jobsProcessed: 100,
      consecutiveClosedJobs: 5,
      jobsSkippedOld: 0,
      jobsSkippedClosed: 0,
    };

    const result = checkStopConditions(stats, {
      maxJobsPerSearch: 100,
      consecutiveClosedLimit: 5,
    });

    expect(result.shouldStop).toBe(true);
  });
});

describe("isJobTooOld", () => {
  it("should return true for jobs older than max age", () => {
    const date = new Date();
    date.setDate(date.getDate() - 61); // 61 days ago

    const result = isJobTooOld(date, 60);

    expect(result).toBe(true);
  });

  it("should return false for jobs within max age", () => {
    const date = new Date();
    date.setDate(date.getDate() - 59); // 59 days ago

    const result = isJobTooOld(date, 60);

    expect(result).toBe(false);
  });

  it("should return false for jobs exactly at max age boundary", () => {
    const date = new Date();
    date.setDate(date.getDate() - 60); // Exactly 60 days ago

    const result = isJobTooOld(date, 60);

    expect(result).toBe(false);
  });

  it("should return false when date is null", () => {
    const result = isJobTooOld(null, 60);

    expect(result).toBe(false);
  });

  it("should return false for recent jobs (posted today)", () => {
    const date = new Date();

    const result = isJobTooOld(date, 60);

    expect(result).toBe(false);
  });

  it("should handle very old jobs correctly", () => {
    const date = new Date();
    date.setDate(date.getDate() - 365); // 1 year ago

    const result = isJobTooOld(date, 60);

    expect(result).toBe(true);
  });

  it("should handle different max age limits", () => {
    const date = new Date();
    date.setDate(date.getDate() - 31); // 31 days ago

    expect(isJobTooOld(date, 30)).toBe(true);
    expect(isJobTooOld(date, 60)).toBe(false);
  });
});

describe("isJobClosed", () => {
  it("should return true for 'closed' status", () => {
    expect(isJobClosed("closed")).toBe(true);
  });

  it("should return true for 'expired' status", () => {
    expect(isJobClosed("expired")).toBe(true);
  });

  it("should return true for 'filled' status", () => {
    expect(isJobClosed("filled")).toBe(true);
  });

  it("should return true for 'inactive' status", () => {
    expect(isJobClosed("inactive")).toBe(true);
  });

  it("should return true for 'archived' status", () => {
    expect(isJobClosed("archived")).toBe(true);
  });

  it("should return false for 'hiring' status", () => {
    expect(isJobClosed("hiring")).toBe(false);
  });

  it("should return false for 'active' status", () => {
    expect(isJobClosed("active")).toBe(false);
  });

  it("should return false for 'open' status", () => {
    expect(isJobClosed("open")).toBe(false);
  });

  it("should return false when status is null", () => {
    expect(isJobClosed(null)).toBe(false);
  });

  it("should be case-insensitive for closed statuses", () => {
    expect(isJobClosed("CLOSED")).toBe(true);
    expect(isJobClosed("Expired")).toBe(true);
    expect(isJobClosed("FILLED")).toBe(true);
  });

  it("should match partial status strings", () => {
    expect(isJobClosed("Position Closed")).toBe(true);
    expect(isJobClosed("Job has expired")).toBe(true);
    expect(isJobClosed("This position has been filled")).toBe(true);
  });

  it("should not match open statuses with similar words", () => {
    expect(isJobClosed("closing soon")).toBe(false);
    expect(isJobClosed("expires tomorrow")).toBe(false);
  });

  it("should handle empty string", () => {
    expect(isJobClosed("")).toBe(false);
  });

  it("should handle various mixed-case scenarios", () => {
    expect(isJobClosed("InAcTiVe")).toBe(true);
    expect(isJobClosed("ArChIvEd")).toBe(true);
  });
});
