/**
 * Job module - re-exports all job-related functionality
 */

// Job matching
export {
  calculateMatch,
  filterEligibleJobs,
  getMatchingPreferences,
  type JobMatchPreferences,
  type MatchResult,
  upsertJobMatch,
} from "./matcher";

// Job match utilities
export {
  getProfileSkills,
  hasArrayOverlap,
  matchesLocation,
  needsRematching,
} from "./match-utils";

// Job site configurations
export { getSiteName } from "./site-configs";

// Scraping filters and validation
export {
  checkStopConditions,
  getJobInvalidReason,
  isFatalScraperError,
  isJobClosed,
  isJobTooOld,
  isValidJob,
  type JobForValidation,
  type ScrapingStats,
  type StopCondition,
} from "./scrape-filters";
