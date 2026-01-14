/**
 * Scraping Filters and Stop Conditions
 * Centralized logic for filtering jobs and determining when to stop scraping
 */

import {
  LLMAuthenticationError,
  LLMQuotaExceededError,
  LLMRateLimitError,
} from "./llm";

export interface ScrapingStats {
  jobsProcessed: number;
  consecutiveClosedJobs: number;
  jobsSkippedOld: number;
  jobsSkippedClosed: number;
}

export interface StopCondition {
  shouldStop: boolean;
  reason: string;
}

/**
 * Check if scraping should stop based on current stats
 */
export function checkStopConditions(
  stats: ScrapingStats,
  config: { maxJobsPerSearch: number; consecutiveClosedLimit: number },
): StopCondition {
  // Hard limit - prevents runaway scraping
  if (stats.jobsProcessed >= config.maxJobsPerSearch) {
    return {
      shouldStop: true,
      reason:
        `Hard limit reached (${stats.jobsProcessed}/${config.maxJobsPerSearch})`,
    };
  }

  // Consecutive closed jobs - indicates end of active listings
  if (stats.consecutiveClosedJobs >= config.consecutiveClosedLimit) {
    return {
      shouldStop: true,
      reason: `${stats.consecutiveClosedJobs} consecutive closed jobs`,
    };
  }

  return { shouldStop: false, reason: "" };
}

/**
 * Check if a job is too old based on posting date
 */
export function isJobTooOld(
  datePosted: Date | null,
  maxAgeDays: number,
): boolean {
  if (!datePosted) return false; // Don't filter if date unknown

  const maxAge = new Date();
  maxAge.setDate(maxAge.getDate() - maxAgeDays);

  return datePosted < maxAge;
}

/**
 * Check if job status indicates the job is closed/expired
 */
export function isJobClosed(status: string | null): boolean {
  if (!status) return false;

  const closedStatuses = [
    "closed",
    "expired",
    "filled",
    "inactive",
    "archived",
  ];

  return closedStatuses.some((closed) => status.toLowerCase().includes(closed));
}

/**
 * Check if an error is fatal and should stop all scraping immediately
 * Fatal errors indicate permanent failures that won't resolve by retrying other jobs
 */
export function isFatalScraperError(error: Error): boolean {
  // Check for LLM-specific error types
  if (
    error instanceof LLMQuotaExceededError ||
    error instanceof LLMAuthenticationError ||
    error instanceof LLMRateLimitError
  ) {
    return true;
  }

  // Fallback: check error message for other fatal patterns
  const message = error.message.toLowerCase();

  // Permission errors
  if (message.includes("403") || message.includes("forbidden")) {
    return true;
  }

  // Bad request errors (usually code bugs, not retryable)
  if (message.includes("400") || message.includes("bad request")) {
    return true;
  }

  return false;
}
