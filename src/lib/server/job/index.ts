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
