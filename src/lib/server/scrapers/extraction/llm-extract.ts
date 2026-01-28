/**
 * LLM-based extraction functions for job scraping
 */

import { config } from "$lib/server/config";
import { stripHtmlForLlm } from "$lib/server/html/strip";
import { createJobScrapingAiChat } from "$lib/server/ai-chat/job-utils";
import {
  isValidJobPostingDate,
  parseRelativeDate,
} from "$lib/tools/date-utils";
import type { SearchContext } from "./types";

/**
 * Get Directus admin URL for a job record
 */
export function getDirectusJobUrl(jobId: number): string {
  return `${config.directusUrl}/admin/content/jobs/${jobId}`;
}

/**
 * Extract comprehensive job data from search results page (SPA sites)
 * Extracts core fields: title, company, location, salary, skills, remote, date_posted + clickableId
 * Replaces extractJobClickSelectors with richer data extraction
 * @param jobSearchId ID of the job search (used to lookup profile for AI chat)
 * @param strippedSearchResultsHtml Already-stripped HTML with data-clickable-id markers
 * @returns Object with jobs array (11 fields per job)
 */
export async function extractJobsFromSearchPage(
  jobSearchId: number,
  strippedSearchResultsHtml: string,
): Promise<{
  jobs: Array<{
    clickableId: number;
    title: string | null;
    company: string | null;
    location: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    skills: string[] | null;
    remote: string | null;
    date_posted: string | null;
  }>;
}> {
  // Debug: Save stripped HTML for analysis
  if (config.scraperDebugMode) {
    const fs = await import("fs");
    const debugPath = "/tmp/stripped-html-debug.html";
    fs.writeFileSync(debugPath, strippedSearchResultsHtml);
    console.log(`\n📝 Saved stripped HTML to: ${debugPath}\n`);
  }

  // Call AI chat with profile looked up from job search

  const aiResult = await createJobScrapingAiChat<{
    jobs: Array<{
      clickableId: number;
      title: string;
      company: string;
      location: string | null;
      salary_min: number | null;
      salary_max: number | null;
      salary_currency: string | null;
      salary_period: string | null;
      skills: string[] | null;
      remote: string | null;
      date_posted: string | null;
    }>;
  }>(jobSearchId, "extract_jobs_from_search_page", {
    html: strippedSearchResultsHtml,
  });

  if (!aiResult.success || !aiResult.response) {
    console.error(`      ❌ LLM extraction failed: ${aiResult.message}`);
    throw new Error(
      `Failed to extract jobs from search page: ${aiResult.message}`,
    );
  }

  // Validate LLM response structure
  if (!Array.isArray(aiResult.response.jobs)) {
    throw new Error("LLM response missing 'jobs' array");
  }

  // Filter out jobs without a title (can't be a valid job card)
  const jobsWithTitles = aiResult.response.jobs.filter(
    (job: { title: string | null }) => job.title && job.title.trim() !== "",
  );

  console.log(
    `      ✓ LLM extracted ${jobsWithTitles.length} jobs from search page`,
  );

  if (jobsWithTitles.length === 0 && aiResult.response.jobs.length > 0) {
    throw new Error(
      `All ${aiResult.response.jobs.length} LLM-extracted jobs had no title`,
    );
  }

  return {
    jobs: jobsWithTitles,
  };
}

/**
 * Extract job data from job posting HTML using LLM
 * @param jobSearchId ID of the job search (used to lookup profile for AI chat)
 * @param jobHtml HTML content from individual job page (can be full page or modal)
 * @param searchContext Optional context from search page to help identify the correct job
 * @returns Parsed job data including source_url extracted from visible content (apply/share links)
 */
export async function extractJobData(
  jobSearchId: number,
  jobHtml: string,
  searchContext?: SearchContext,
): Promise<{
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
  source_url: string | null;
  source_html_stripped: string;
  ai_chat_extraction: number | null;
}> {
  // 1. Strip HTML to minimal content
  const strippedHtml = stripHtmlForLlm(jobHtml);

  // 2. Check for invalid/closed job pages (Mercor-specific)
  // Invalid pages are very short (< 1500 chars) and only contain notification content
  // Valid job pages have much more content (job description, requirements, etc.)
  if (
    strippedHtml.length < 1500 &&
    strippedHtml.includes("Welcome to Mercor") &&
    strippedHtml.includes("Visit the Mercor Explore Page")
  ) {
    throw new Error(
      "Invalid job page - redirected to notification page (page too short)",
    );
  }

  // 3. Build search context hint for LLM (helps identify correct job on pages with multiple cards)
  let searchContextHint = "";
  if (searchContext?.title || searchContext?.company) {
    const parts = [];
    if (searchContext.title) parts.push(`title: "${searchContext.title}"`);
    if (searchContext.company) {
      parts.push(`company: "${searchContext.company}"`);
    }
    if (searchContext.location) {
      parts.push(`location: "${searchContext.location}"`);
    }
    searchContextHint =
      `\n\nIMPORTANT: We clicked on a specific job from the search results. ` +
      `Look for the DETAILED job information (full description, requirements, etc.) for this job: ${
        parts.join(", ")
      }. ` +
      `The page may show other job cards in a sidebar - ignore those and extract only the main job's details.`;
  }

  // 4. Call AI chat utility to extract job data
  const aiResult = await createJobScrapingAiChat<{
    title?: string | null;
    job_description?: string | null;
    company_description?: string | null;
    job_poster?: string | null;
    date_posted?: string | null;
    location?: string | null;
    remote?: string | null;
    experience_level?: string | null;
    job_type?: string | null;
    salary_min?: number | null;
    salary_max?: number | null;
    salary_currency?: string | null;
    salary_period?: string | null;
    skills?: string[] | null;
    status?: string | null;
    source_url?: string | null;
  }>(jobSearchId, "extract_job_data", {
    html: strippedHtml,
    searchContextHint: searchContextHint,
  });

  if (!aiResult.success || !aiResult.response) {
    throw new Error(`Failed to extract job data: ${aiResult.message}`);
  }

  const data = aiResult.response;

  try {
    // 7. If LLM didn't extract date, try fallback regex extraction
    if (!data.date_posted) {
      // Look for "Posted X ago" patterns in the stripped HTML
      // Match: "Posted 3 months ago", "Posted a month ago", "Posted yesterday", etc.
      const datePattern =
        /Posted\s+(?:a\s+)?(?:\d+\s+)?(?:month|day|week|year|hour|minute)s?\s+ago/gi;
      const matches = strippedHtml.match(datePattern);

      if (matches && matches.length > 0) {
        // For Mercor jobs, the main job's date typically appears last (after similar jobs)
        // Take the last match
        const lastMatch = matches[matches.length - 1];
        console.log(
          `  Fallback: Found ${matches.length} date(s), using last one: "${lastMatch}"`,
        );
        data.date_posted = lastMatch;
      }
    }

    // 8. Parse and validate date_posted
    const parsedDate = parseRelativeDate(data.date_posted);
    let finalDatePosted: Date | null = null;

    // Validate the parsed date
    if (parsedDate && isValidJobPostingDate(parsedDate)) {
      finalDatePosted = parsedDate;
    } else if (data.date_posted) {
      // Invalid or unparseable date - log warning
      console.warn(
        `Invalid date_posted for job "${data.title}": "${data.date_posted}" - setting to null`,
      );
    }

    // 9. Normalize title: convert empty strings to null, keep valid titles as-is
    const normalizedTitle = (data.title && data.title.trim() !== "")
      ? data.title
      : null;

    // 10. Include stripped HTML and AI chat ID in return value for database storage
    return {
      title: normalizedTitle,
      job_description: data.job_description ?? null,
      company_description: data.company_description ?? null,
      job_poster: data.job_poster ?? null,
      date_posted: finalDatePosted,
      location: data.location ?? null,
      remote: data.remote ?? null,
      experience_level: data.experience_level ?? null,
      job_type: data.job_type ?? null,
      salary_min: data.salary_min ?? null,
      salary_max: data.salary_max ?? null,
      salary_currency: data.salary_currency ?? null,
      salary_period: data.salary_period ?? null,
      skills: data.skills ?? null,
      status: data.status ?? null,
      source_url: data.source_url ?? null,
      source_html_stripped: strippedHtml,
      ai_chat_extraction: aiResult.aiChatId,
    };
  } catch (error) {
    console.error("Failed to parse job data from LLM response:", error);
    throw new Error(
      `Failed to extract job data: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}
