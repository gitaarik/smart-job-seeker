/**
 * Scraping Filters and Stop Conditions
 * Centralized logic for filtering jobs and determining when to stop scraping
 */

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
