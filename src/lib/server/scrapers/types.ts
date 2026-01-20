/**
 * Type definitions for job scrapers
 */

/**
 * Job data extracted from search results page
 * Contains basic info visible in job cards/listings
 */
export interface SearchPageJob {
  clickableId: number;
  title: string | null;
  company?: string | null;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  skills?: string[] | null;
  remote?: string | null;
  date_posted?: string | null;
}

/**
 * Job data extracted from job detail page
 * Contains full job information
 */
export interface DetailPageJob {
  title: string | null;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  date_posted: Date | null;
  location: string | null;
  remote: string | null;
  experience_level: string | null;
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[] | null;
  status: string | null;
  source_html_stripped: string;
  ai_chat_extraction: number | null;
}

/**
 * Result from Browser-Use login attempt
 */
export interface LoginResult {
  login_success: boolean;
  captcha_needed?: boolean;
  verification_needed?: boolean;
  verification_type?: string;
  verification_prompt?: string;
  current_url: string;
  cdp_port?: number;
  execution_time_ms?: number;
  error?: string;
}

/**
 * Result from verification code submission
 */
export interface VerificationResult {
  success: boolean;
  login_complete: boolean;
  needs_new_code: boolean;
  captcha_needed?: boolean;
  current_url: string;
  execution_time_ms?: number;
  error?: string;
}

/**
 * Result from job scraping operation
 */
export interface ScrapeResult {
  jobsProcessed: number;
  strippedHtml: string;
}

/**
 * Platform information from database
 */
export interface Platform {
  id: number;
  name: string;
  url: string;
  login_page_url?: string | null;
}

/**
 * Credentials for platform login
 */
export interface PlatformCredentials {
  username: string;
  password: string;
}

/**
 * Job data for logging/display purposes
 */
export interface JobDisplayData {
  title: string | null;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  date_posted: Date | string | null;
  location: string | null;
  remote: string | null;
  experience_level: string | null;
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[] | null;
}

/**
 * Result from upsert operation
 */
export interface UpsertResult {
  id: number;
  created: boolean;
}
