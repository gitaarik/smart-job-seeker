/**
 * LLM-based extraction functions for job scraping
 */

import { config } from "$lib/server/config";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import { createJobScrapingAiChat } from "$lib/server/ai-chat-job-utils";
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
 * @param strippedSearchResultsHtml Already-stripped HTML with data-clickable-id markers
 * @returns Object with jobs array (11 fields per job)
 */
export async function extractJobsFromSearchPage(
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

  // Extract all data-extract-clickable-id values with regex
  const clickableIdMatches = strippedSearchResultsHtml.match(
    /data-extract-clickable-id="(\d+)"/g,
  );

  let allClickableIds: number[] = [];
  if (clickableIdMatches) {
    allClickableIds = clickableIdMatches
      .map((m) => parseInt(m.match(/\d+/)?.[0] || "0"))
      .filter((id) => !isNaN(id)); // Allow ID 0, just filter out NaN
    console.log(
      `      Found ${allClickableIds.length} data-extract-clickable-id attributes in stripped HTML`,
    );
    console.log(`      All IDs: [${allClickableIds.join(", ")}]`);
  } else {
    console.warn(
      "      ⚠️  No data-extract-clickable-id attributes found in stripped HTML!",
    );
  }

  // 2. Call AI chat with system profile for job scraping
  console.log("      🤖 Running LLM to extract job data from search page...");

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
  }>("extract_jobs_from_search_page", { html: strippedSearchResultsHtml });

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

  console.log(
    `      ✓ LLM extracted ${aiResult.response.jobs.length} jobs from search page`,
  );

  // CRITICAL: Validate that LLM IDs actually exist in the page
  const validJobs = aiResult.response.jobs.filter((job: any) => {
    const idExists = allClickableIds.includes(job.clickableId);
    if (!idExists) {
      console.warn(
        `      ⚠️  LLM hallucinated ID ${job.clickableId} (title: "${job.title}") - not in page`,
      );
    }
    return idExists;
  });

  console.log(
    `      → ${validJobs.length} jobs with valid IDs (filtered ${
      aiResult.response.jobs.length - validJobs.length
    } hallucinated)`,
  );

  // Filter out jobs without a title (can't be a valid job card)
  const jobsWithTitles = validJobs.filter((job: { title: string | null }) => {
    const hasTitle = job.title && job.title.trim() !== "";
    if (!hasTitle) {
      console.warn(
        `      ⚠️  Filtered job with ID ${(job as any).clickableId} - no title`,
      );
    }
    return hasTitle;
  });

  if (jobsWithTitles.length < validJobs.length) {
    console.log(
      `      → ${jobsWithTitles.length} jobs with titles (filtered ${
        validJobs.length - jobsWithTitles.length
      } without title)`,
    );
  }

  // If all IDs were hallucinated or had no title, throw error
  if (jobsWithTitles.length === 0 && aiResult.response.jobs.length > 0) {
    throw new Error(
      `All ${aiResult.response.jobs.length} LLM-extracted jobs were invalid (hallucinated IDs or missing titles)`,
    );
  }

  return {
    jobs: jobsWithTitles,
  };
}

/**
 * Extract job data from job posting HTML using LLM
 * @param jobHtml HTML content from individual job page (can be full page or modal)
 * @param sourceUrl URL of the job page
 * @param searchContext Optional context from search page to help identify the correct job
 * @returns Parsed job data
 */
export async function extractJobData(
  jobHtml: string,
  sourceUrl: string,
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
  // Log LLM request with HTML sample from middle (for debugging)
  const midPoint = Math.floor(strippedHtml.length / 2);
  const htmlSample = strippedHtml.substring(midPoint - 100, midPoint + 100);
  console.log(
    `      🤖 LLM request: extract_job_data (${strippedHtml.length} chars)`,
  );
  console.log(`      📄 HTML sample (mid): "...${htmlSample}..."`);

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
  }>("extract_job_data", {
    html: strippedHtml,
    sourceUrl: sourceUrl,
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

    // Validate the parsed date
    if (parsedDate && isValidJobPostingDate(parsedDate)) {
      data.date_posted = parsedDate;
    } else {
      // Invalid or unparseable date - log warning and set to null
      if (data.date_posted) {
        console.warn(
          `Invalid date_posted for job "${data.title}": "${data.date_posted}" - setting to null`,
        );
      }
      data.date_posted = null;
    }

    // 9. Normalize title: convert empty strings to null, keep valid titles as-is
    const normalizedTitle = (data.title && data.title.trim() !== "")
      ? data.title
      : null;

    // 10. Include stripped HTML and AI chat ID in return value for database storage
    return {
      ...data,
      title: normalizedTitle,
      source_html_stripped: strippedHtml,
      ai_chat_extraction: aiResult.aiChatId,
    };
  } catch (error) {
    console.error("Failed to parse job data from LLM response:", error);
    throw new Error(
      `Failed to extract job data from ${sourceUrl}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}
