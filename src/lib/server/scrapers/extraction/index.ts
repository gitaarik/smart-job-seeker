/**
 * Job extraction module
 * Re-exports all public extraction APIs
 */

export type { SearchContext } from "./types";
export { validateJobSearchHtml } from "./validation";
export { mergeJobData, mergeSkills } from "./merge";
export { extractJobData, extractJobsFromSearchPage } from "./llm-extract";
export { scrapeJobsWithClicks } from "./scrape-with-clicks";

// Click handling
export {
  clickJobCard,
  type ClickResult,
  getElementInfo,
  isNavigableHref,
  returnToSearchPage,
} from "./click-handler";

// Source URL extraction
export {
  extractSourceUrl,
  type SourceUrlContext,
  type SourceUrlMethod,
  type SourceUrlResult,
} from "./source-url";
