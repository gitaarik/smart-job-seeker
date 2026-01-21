/**
 * Types for job extraction
 */

/**
 * Search context from the job search page
 * Used to help LLM identify the correct job when page contains multiple job cards
 */
export interface SearchContext {
  title?: string | null;
  company?: string | null;
  location?: string | null;
}
