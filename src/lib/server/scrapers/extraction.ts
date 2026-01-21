/**
 * Extraction module for job scrapers
 * Contains: LLM extraction functions, data merging, click-based scraping
 */

import type { Page } from "playwright";
import { dbDirect } from "$lib/db";
import { config } from "$lib/server/config";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import {
  checkStopConditions,
  getJobInvalidReason,
  isFatalScraperError,
  isJobClosed,
  isJobTooOld,
  isValidJob,
} from "$lib/server/scrape-filters";
import { markClickableElementsInContainer } from "$lib/server/cdp-utils";
import {
  detectPaginationStrategy,
  navigateToNextPage,
  performInfiniteScroll,
} from "$lib/server/pagination-utils";
import { waitForSpaContent } from "$lib/server/page-wait-utils";
import { performPatchwrightLogin } from "../patchright-login";
import { getErrorMessage, promptUser, SCRAPER_CONSTANTS } from "./utils";
import { formatSalary, upsertJob } from "./job-data";
import { createJobScrapingAiChat } from "$lib/server/ai-chat-job-utils";
import {
  humanClick,
  humanWait,
  injectStealthScripts,
} from "$lib/server/stealth-utils";
import {
  isValidJobPostingDate,
  parseRelativeDate,
} from "$lib/tools/date-utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Search context from the job search page
 * Used to help LLM identify the correct job when page contains multiple job cards
 */
export interface SearchContext {
  title?: string | null;
  company?: string | null;
  location?: string | null;
}

// ============================================================================
// HTML Validation
// ============================================================================

/**
 * Validate job search HTML before processing
 * Checks for common issues like login pages, errors, CAPTCHA, etc.
 */
export function validateJobSearchHtml(html: string): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check minimum content length
  if (html.length < 1000) {
    warnings.push("HTML content suspiciously short (< 1000 chars)");
  }

  // Check for error pages
  if (html.includes("404") || html.toLowerCase().includes("not found")) {
    warnings.push("Error page (404) detected");
  }

  // Check for CAPTCHA
  if (html.toLowerCase().includes("captcha")) {
    warnings.push("CAPTCHA challenge detected");
  }

  // Check for rate limiting
  if (
    html.toLowerCase().includes("rate limit") ||
    html.toLowerCase().includes("too many requests")
  ) {
    warnings.push("Rate limiting detected");
  }

  return { isValid: warnings.length === 0, warnings };
}

// ============================================================================
// Data Merging
// ============================================================================

/**
 * Merge skills from search page and detail page, deduplicating case-insensitively
 * @param searchSkills Skills array from search page extraction
 * @param detailSkills Skills array from detail page extraction
 * @returns Merged and deduplicated skills array, or null if both are null
 */
export function mergeSkills(
  searchSkills: string[] | null,
  detailSkills: string[] | null,
): string[] | null {
  if (!searchSkills && !detailSkills) return null;
  if (!searchSkills) return detailSkills;
  if (!detailSkills) return searchSkills;

  // Deduplicate case-insensitively, preserving first occurrence's casing
  const seen = new Map<string, string>();
  for (const skill of [...searchSkills, ...detailSkills]) {
    const lower = skill.toLowerCase();
    if (!seen.has(lower)) {
      seen.set(lower, skill); // First occurrence wins
    }
  }
  return Array.from(seen.values());
}

/**
 * Merge job data from search page and detail page
 * Priority: Detail page wins for all fields except skills (which are merged)
 * Search page data serves as fallback when detail page has null values
 * @param searchData Partial job data from search results page
 * @param detailData Complete job data from detail page
 * @returns Merged job data with detail page taking priority
 */
export function mergeJobData(
  searchData: Partial<{
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
  }>,
  detailData: {
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
  },
): typeof detailData {
  return {
    // Always from detail (not extracted from search)
    job_description: detailData.job_description,
    company_description: detailData.company_description,
    experience_level: detailData.experience_level,
    job_type: detailData.job_type,
    status: detailData.status,
    source_html_stripped: detailData.source_html_stripped,
    ai_chat_extraction: detailData.ai_chat_extraction,

    // Detail wins, search fallback (using || for strings, ?? for numbers)
    title: detailData.title || searchData.title || "Untitled Position",
    job_poster: detailData.job_poster || searchData.company || null,
    location: detailData.location || searchData.location || null,
    remote: detailData.remote || searchData.remote || null,

    // Date: Detail wins, or parse search date if detail is null
    date_posted: detailData.date_posted ||
      (searchData.date_posted
        ? parseRelativeDate(searchData.date_posted)
        : null),

    // Salary: Detail wins, search fallback (use ?? to preserve 0 values)
    salary_min: detailData.salary_min ?? searchData.salary_min ?? null,
    salary_max: detailData.salary_max ?? searchData.salary_max ?? null,
    salary_currency: detailData.salary_currency || searchData.salary_currency ||
      null,
    salary_period: detailData.salary_period || searchData.salary_period || null,

    // Skills: MERGE both sources (deduplicate)
    skills: mergeSkills(searchData.skills || null, detailData.skills),
  };
}

// ============================================================================
// LLM Extraction Functions
// ============================================================================

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

// ============================================================================
// Click-Based Scraping Helpers
// ============================================================================

/**
 * Log detailed job data after saving
 */
function logJobDetails(
  jobData: {
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
  },
  sourceUrl: string,
): void {
  const cap = (s: string | null | undefined, len: number) =>
    s ? (s.length > len ? s.substring(0, len) + "..." : s) : "-";

  const formatDate = (d: Date | string | null) => {
    if (!d) return "-";
    if (d instanceof Date) return d.toISOString().split("T")[0];
    return String(d).split("T")[0];
  };

  console.log(`         📋 Title: ${jobData.title || "-"}`);
  console.log(`         🔗 URL: ${sourceUrl}`);
  console.log(`         🏢 Company: ${jobData.job_poster || "-"}`);
  console.log(`         📅 Posted: ${formatDate(jobData.date_posted)}`);
  console.log(`         📍 Location: ${jobData.location || "-"}`);
  console.log(`         🏠 Remote: ${jobData.remote || "-"}`);
  console.log(`         💼 Job Type: ${jobData.job_type || "-"}`);
  console.log(`         📊 Experience: ${jobData.experience_level || "-"}`);
  console.log(`         💰 Salary: ${formatSalary(jobData)}`);
  console.log(`         🔧 Skills: ${jobData.skills?.join(", ") || "-"}`);
  console.log(`         📝 Description: ${cap(jobData.job_description, 150)}`);
  console.log(
    `         🏛️ Company Info: ${cap(jobData.company_description, 150)}`,
  );
}

/**
 * Classify marked clickable elements using LLM
 * Determines which elements open job details vs perform actions
 */
async function classifyMarkedClickables(
  page: Page,
): Promise<Map<number, "view-details" | "action">> {
  // 1. Extract metadata for all marked clickables
  const clickableMetadata = await page.evaluate(() => {
    const clickables: Array<{
      id: number;
      text: string;
      tagName: string;
      className: string;
    }> = [];
    document.querySelectorAll("[data-extract-clickable-id]").forEach((el) => {
      clickables.push({
        id: parseInt(el.getAttribute("data-extract-clickable-id") || "0"),
        text: el.textContent?.trim().substring(0, 100) || "",
        tagName: el.tagName.toLowerCase(),
        className: el.className || "",
      });
    });
    return clickables;
  });

  // 2. Skip LLM if no clickables or just one
  if (clickableMetadata.length <= 1) {
    return new Map(
      clickableMetadata.map((c) => [c.id, "view-details" as const]),
    );
  }

  // 3. Format for LLM
  const clickablesText = clickableMetadata
    .map((c) =>
      `ID ${c.id}: "${c.text}" (${c.tagName}, class="${c.className}")`
    )
    .join("\n");

  // 4. Call LLM for classification
  const result = await createJobScrapingAiChat<{
    clickables: Array<{ id: number; type: "view-details" | "action" }>;
  }>("classify_clickables", { clickables: clickablesText });

  // 5. Build classification map
  const classificationMap = new Map<number, "view-details" | "action">();
  if (result.success && result.response?.clickables) {
    for (const c of result.response.clickables) {
      classificationMap.set(c.id, c.type);
    }
  }

  // 6. Default unclassified to "view-details"
  for (const c of clickableMetadata) {
    if (!classificationMap.has(c.id)) {
      classificationMap.set(c.id, "view-details");
    }
  }

  return classificationMap;
}

/**
 * Strip action clickables from HTML by removing their data-extract-clickable-id attributes
 */
function stripActionClickables(
  html: string,
  classifications: Map<number, "view-details" | "action">,
): string {
  let result = html;
  for (const [id, type] of classifications) {
    if (type === "action") {
      // Remove the data-extract-clickable-id attribute for action clickables
      result = result.replace(
        new RegExp(`data-extract-clickable-id="${id}"`, "g"),
        "",
      );
    }
  }
  return result;
}

/**
 * Check if page content is still loading and retry extraction if so.
 * Used when LLM extraction finds no jobs or all invalid jobs - the page might still be loading.
 */
async function tryContentRetryOnLoad(
  page: Page,
  pageNumber: number,
  extractionAttempt: number,
  maxLlmRetries: number,
  jobSearchId: number | undefined,
  currentSavedHtml: string,
): Promise<{
  shouldRetry: boolean;
  newStrippedHtml: string;
  savedHtml: string;
}> {
  const contentWait = await waitForSpaContent(page, {
    maxAttempts: config.scraperSpaContentPollAttempts,
    pollInterval: config.scraperSpaContentPollInterval,
    minGrowthThreshold: config.scraperSpaMinContentGrowth,
  });

  if (contentWait.totalGrowth >= config.scraperSpaMinContentGrowth) {
    // Content grew - re-capture HTML and retry
    console.log(
      `      ⏳ Content grew ${contentWait.totalGrowth.toLocaleString()} chars, re-extracting...`,
    );

    // Re-mark clickable elements (new elements may have loaded)
    console.log("      📍 Re-marking clickable elements...");
    const newClickableCount = await markClickableElementsInContainer(
      page,
      "body",
    );
    console.log(`      ✓ Found ${newClickableCount} elements`);

    // Re-capture HTML
    const newMarkedHtml = await page.content();
    const newStrippedHtml = stripHtmlForLlm(newMarkedHtml);

    // Update saved HTML if this is page 1
    let savedHtml = currentSavedHtml;
    if (pageNumber === 1) {
      savedHtml = newStrippedHtml;

      // Update database with new stripped HTML
      if (jobSearchId) {
        await dbDirect.job_searches.update({
          where: { id: jobSearchId },
          data: { stripped_html: newStrippedHtml },
        });
      }
    }

    console.log(
      `      🤖 Retry extraction attempt ${extractionAttempt + 1}/${
        maxLlmRetries + 1
      }...`,
    );

    return { shouldRetry: true, newStrippedHtml, savedHtml };
  }

  // Content stabilized - no retry
  return {
    shouldRetry: false,
    newStrippedHtml: "",
    savedHtml: currentSavedHtml,
  };
}

// ============================================================================
// Main Click-Based Scraping Function
// ============================================================================

/**
 * Scrape jobs using click-based navigation (SPAs)
 * Marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 * Extracts and saves jobs immediately during clicking for real-time feedback
 * @param page Patchright page instance
 * @param searchUrl URL of the search results page
 * @param platformId Platform ID for job storage
 * @param profileId Optional profile ID for credential-based login
 * @param jobSearchId Optional job search ID for Directus URL logging
 * @returns Object with jobsProcessed count and strippedHtml for debugging
 */
export async function scrapeJobsWithClicks(
  page: Page,
  searchUrl: string,
  platformId: string,
  profileId?: number,
  jobSearchId?: number,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
  console.log("\n🔄 Starting SPA scraping mode (click-based navigation)");

  // Attempt login if credentials provided
  if (profileId) {
    const loginSuccess = await performPatchwrightLogin(
      page,
      Number(platformId),
      profileId,
    );
    if (loginSuccess) {
      // Navigate back to search URL after successful login
      console.log(`🔙 Navigating back to search URL...`);
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } else {
      console.warn(
        "⚠️  Login failed, continuing with unauthenticated scraping",
      );
    }
  }

  // Inject stealth scripts to hide automation markers
  await injectStealthScripts(page);

  // Wait for page to fully render (SPAs need time)
  console.log("⏳ Waiting for SPA to fully render...");
  await humanWait(page, 3000);
  console.log(`📍 Current URL: ${page.url()}`);

  // Initialize stats
  const stats = {
    jobsProcessed: 0,
    consecutiveClosedJobs: 0,
    jobsImportedStale: 0,
    jobsImportedClosed: 0,
  };

  let pageNumber = 1;
  let savedStrippedHtml = ""; // Store stripped HTML from first page for debugging
  let previousPageJobIds: number[] = []; // Track job IDs from previous page to detect duplicates

  // Pagination loop
  while (pageNumber <= config.scraperPaginationMaxPages) {
    console.log(`\n📄 Page ${pageNumber}...`);

    // Mark all clickable elements using CDP
    console.log("   📍 Step 1/3: Detecting click handlers via CDP...");
    const startCdp = Date.now();

    const clickableCount = await markClickableElementsInContainer(page, "body");

    const cdpDuration = ((Date.now() - startCdp) / 1000).toFixed(2);
    console.log(
      `      ✓ Found ${clickableCount} elements with click listeners (${cdpDuration}s)`,
    );

    if (clickableCount === 0) {
      console.log(
        "      ⚠️  No clickable elements found - page may not be loaded",
      );
      break;
    }

    // Classify clickables with LLM to filter out action buttons (Apply, Share, etc.)
    let clickableClassifications:
      | Map<
        number,
        "view-details" | "action"
      >
      | null = null;
    if (clickableCount > 1) {
      console.log("   🏷️  Step 1.5/3: Classifying clickables with LLM...");
      const startClassify = Date.now();
      clickableClassifications = await classifyMarkedClickables(page);
      const actionCount = [...clickableClassifications.values()].filter(
        (v) => v === "action",
      ).length;
      const classifyDuration = ((Date.now() - startClassify) / 1000).toFixed(2);
      console.log(
        `      ✓ ${
          clickableCount - actionCount
        } view-details, ${actionCount} action (${classifyDuration}s)`,
      );
    }

    // Get marked HTML
    const markedHtml = await page.content();

    // Debug: Log current URL and page title at time of HTML capture
    const captureUrl = page.url();
    const captureTitle = await page.title();
    console.log(`      📍 Capturing HTML from: ${captureUrl}`);
    console.log(`      📄 Page title: "${captureTitle}"`);

    // Strip action clickables from HTML before LLM extraction
    const cleanedHtml = clickableClassifications
      ? stripActionClickables(markedHtml, clickableClassifications)
      : markedHtml;

    const htmlSize = (cleanedHtml.length / 1024).toFixed(1);
    console.log(`      HTML size (raw): ${htmlSize} KB`);

    // Strip HTML for LLM processing (data-extract-clickable-id attributes survive)
    const strippedHtml = stripHtmlForLlm(cleanedHtml);

    // Debug: Count clickable IDs that survived stripping
    const clickableIdMatches = strippedHtml.match(/data-extract-clickable-id/g);
    const survivingClickables = clickableIdMatches
      ? clickableIdMatches.length
      : 0;
    const strippedSize = (strippedHtml.length / 1024).toFixed(1);
    console.log(
      `      HTML size (stripped): ${strippedSize} KB, clickables preserved: ${survivingClickables}/${clickableCount}`,
    );

    // Capture stripped HTML from first page BEFORE LLM extraction (so we save it even if LLM fails)
    if (pageNumber === 1) {
      // Prepend debug metadata to help diagnose issues
      const debugHeader = [
        `<!-- DEBUG INFO`,
        `URL: ${captureUrl}`,
        `Title: ${captureTitle}`,
        `Raw HTML: ${htmlSize} KB`,
        `Stripped HTML: ${strippedSize} KB`,
        `CDP clickables found: ${clickableCount}`,
        `Clickables after strip: ${survivingClickables}`,
        `Timestamp: ${new Date().toISOString()}`,
        `-->`,
      ].join("\n");

      savedStrippedHtml = debugHeader + "\n" + strippedHtml;

      // Log Directus admin URL for debugging stripped HTML
      if (jobSearchId) {
        const directusUrl = process.env.PUBLIC_ADMIN_URL ||
          "http://localhost:8055";
        console.log(
          `      📋 Debug stripped HTML: ${directusUrl}/admin/content/job_searches/${jobSearchId}`,
        );

        // Save stripped HTML immediately for debugging (before LLM extraction or interactive prompts)
        await dbDirect.job_searches.update({
          where: { id: jobSearchId },
          data: { stripped_html: savedStrippedHtml },
        });
      }
    }

    // Always use LLM to extract jobs with titles (even when CDP detects job-detail buttons)
    // Includes retry logic for slow-loading SPAs that may not have rendered job cards yet
    console.log(
      "\n   🤖 Step 2/3: Asking LLM to extract job cards with titles...",
    );

    let jobs: Array<
      {
        clickableId: number;
        title: string | null;
        company?: string | null;
        location?: string | null;
        salary_min?: number | null;
        salary_max?: number | null;
        salary_currency?: string | null;
        salary_period?: string | null;
      }
    > = [];

    let currentStrippedHtml = strippedHtml;
    let extractionAttempt = 0;
    const maxLlmRetries = config.scraperSpaLlmRetryAttempts;

    // Extraction loop with SPA content loading detection
    while (extractionAttempt <= maxLlmRetries) {
      extractionAttempt++;
      const startLlm = Date.now();

      try {
        const result = await extractJobsFromSearchPage(currentStrippedHtml);
        jobs = result.jobs;

        const llmDuration = ((Date.now() - startLlm) / 1000).toFixed(2);
        console.log(`      ✓ LLM analysis complete (${llmDuration}s)`);
        console.log(`      Job cards found: ${jobs.length}`);

        // If jobs found, we're done
        if (jobs.length > 0) {
          if (extractionAttempt > 1) {
            console.log(
              `      ℹ️  Required ${extractionAttempt} extraction attempts`,
            );
          }
          break;
        }

        // No jobs found - check if page is still loading (only if we have retries left)
        if (extractionAttempt <= maxLlmRetries) {
          console.log(
            "      ⚠️  No jobs found, checking if page is still loading...",
          );

          const retry = await tryContentRetryOnLoad(
            page,
            pageNumber,
            extractionAttempt,
            maxLlmRetries,
            jobSearchId,
            savedStrippedHtml,
          );

          if (retry.shouldRetry) {
            currentStrippedHtml = retry.newStrippedHtml;
            savedStrippedHtml = retry.savedHtml;
            continue;
          } else {
            console.log("      📊 Content stabilized but no job cards found");
            break;
          }
        }
      } catch (error) {
        const errorMsg = getErrorMessage(error);

        // Check if this is an "all jobs invalid" error - treat like 0 jobs found
        const isAllInvalidError = errorMsg.includes("were invalid") ||
          errorMsg.includes("hallucinated");

        if (isAllInvalidError && extractionAttempt <= maxLlmRetries) {
          console.log(
            "      ⚠️  All extracted jobs were invalid, checking if page is still loading...",
          );

          const retry = await tryContentRetryOnLoad(
            page,
            pageNumber,
            extractionAttempt,
            maxLlmRetries,
            jobSearchId,
            savedStrippedHtml,
          );

          if (retry.shouldRetry) {
            currentStrippedHtml = retry.newStrippedHtml;
            savedStrippedHtml = retry.savedHtml;
            continue;
          } else {
            console.log(
              "      📊 Content stabilized but no valid job cards found",
            );
          }
        }

        console.error(`      ❌ LLM extraction failed: ${errorMsg}`);
        console.log(
          `      ℹ️  Returning stripped HTML for debugging (${savedStrippedHtml.length} chars)`,
        );
        // Return early with stripped HTML so it gets saved to database
        return {
          jobsProcessed: stats.jobsProcessed,
          strippedHtml: savedStrippedHtml,
        };
      }
    }

    // Log job cards found by LLM (now with preserved semantic class names for context)
    console.log(
      `      Jobs: [${
        jobs.map((j) => `${j.clickableId}:${j.title || "?"}`).join(", ")
      }]`,
    );

    // Ask user confirmation on first page before processing
    if (pageNumber === 1 && jobs.length > 0) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 Found ${jobs.length} job cards to process:\n`);

      for (const job of jobs) {
        const title = job.title || "(no title)";
        const company = job.company || "(no company)";
        console.log(`  #${job.clickableId}: ${title} @ ${company}`);
      }

      console.log(`\n${"=".repeat(60)}`);

      let answer = "";
      while (answer !== "y" && answer !== "n") {
        answer = (await promptUser(
          `\nProceed with importing these ${jobs.length} jobs? (y/n): `,
        )).toLowerCase();
      }

      if (answer !== "y") {
        console.log("❌ Scraping cancelled by user");
        return {
          jobsProcessed: 0,
          strippedHtml: savedStrippedHtml,
        };
      }

      console.log("✅ Proceeding with import...\n");
    }

    // Detect duplicate pages (SPA pagination false positives)
    if (pageNumber > 1 && previousPageJobIds.length > 0) {
      const currentJobIds = jobs.map((j) => j.clickableId);
      const duplicateCount = currentJobIds.filter((id) =>
        previousPageJobIds.includes(id)
      ).length;
      const duplicatePercentage = (duplicateCount / currentJobIds.length) *
        100;

      if (
        duplicatePercentage > SCRAPER_CONSTANTS.DUPLICATE_PAGE_THRESHOLD_PERCENT
      ) {
        console.log(
          `\n   ⏭️  Stopping: ${
            duplicatePercentage.toFixed(0)
          }% duplicate jobs (${duplicateCount}/${currentJobIds.length})`,
        );
        console.log(
          "   This page has the same jobs as the previous page (SPA pagination artifact)",
        );
        break;
      }
    }

    // Store current page job IDs for next iteration
    previousPageJobIds = jobs.map((j) => j.clickableId);

    // Check for login/signup page
    const pageText = await page.textContent("body") || "";
    const lowerText = pageText.toLowerCase();

    // More specific login detection: look for login forms, not just text
    const hasLoginForm = await page.locator('form[action*="login"]').count() >
        0 ||
      await page.locator('input[type="password"]').count() > 0;

    const hasLoginKeywords = lowerText.includes("sign in to continue") ||
      lowerText.includes("log in to continue") ||
      lowerText.includes("create an account") ||
      (lowerText.includes("email") && lowerText.includes("password") &&
        lowerText.includes("submit"));

    const isLoginPage = hasLoginForm || hasLoginKeywords;

    if (isLoginPage && jobs.length < 5) {
      console.log(
        "\n   🚫 Login/signup page detected - stopping scrape",
      );
      console.log(
        `   Reason: hasLoginForm=${hasLoginForm}, hasLoginKeywords=${hasLoginKeywords}, jobs=${jobs.length}`,
      );
      console.log(
        "   💡 Please log in manually in the browser and run the scraper again",
      );
      break;
    }

    if (jobs.length === 0) {
      console.log("      ⚠️  No job cards found in the page");
      break;
    }

    // Click each identified job card and process immediately
    console.log(
      `\n   👆 Step 3/3: Clicking and processing ${jobs.length} job cards...\n`,
    );
    for (let i = 0; i < jobs.length; i++) {
      const searchJobData = jobs[i];
      const { clickableId } = searchJobData;
      const jobNumber = i + 1;
      const pseudoUrl = `${searchUrl}#spa-job-${jobNumber}`;

      // Visual separator for each job
      console.log(`\n   [${"─".repeat(56)}]`);
      console.log(`   Job ${jobNumber}/${jobs.length}`);
      console.log(`   [${"─".repeat(56)}]`);

      // Log search page data if available
      if (searchJobData.title) {
        console.log(`      📋 Title: "${searchJobData.title}"`);
      }
      if (searchJobData.company) {
        console.log(`      🏢 Company: "${searchJobData.company}"`);
      }
      if (searchJobData.location) {
        console.log(`      📍 Location: "${searchJobData.location}"`);
      }
      if (searchJobData.salary_min || searchJobData.salary_max) {
        const salaryStr = [
          searchJobData.salary_currency || "",
          searchJobData.salary_min?.toLocaleString() || "",
          searchJobData.salary_max
            ? `-${searchJobData.salary_max.toLocaleString()}`
            : "",
          searchJobData.salary_period
            ? `per ${searchJobData.salary_period}`
            : "",
        ].filter(Boolean).join(" ");
        console.log(`      💰 Salary: ${salaryStr}`);
      }

      try {
        // Get element info before clicking for debugging
        const elementInfo = await page.locator(
          `[data-extract-clickable-id="${clickableId}"]`,
        ).evaluate((el) => {
          const tag = el.tagName.toLowerCase();
          // Normalize whitespace (collapse newlines/spaces) then trim
          const text =
            el.textContent?.replace(/\s+/g, " ").trim().substring(0, 50) || "";
          const href = el.getAttribute("href")?.substring(0, 60) || "";
          const ariaLabel = el.getAttribute("aria-label")?.substring(0, 50) ||
            "";
          const className = el.className?.toString().substring(0, 50) || "";
          return { tag, text, href, ariaLabel, className };
        }).catch(() => ({
          tag: "?",
          text: "",
          href: "",
          ariaLabel: "",
          className: "",
        }));

        // Log what element we're clicking
        const elementDesc = [
          `<${elementInfo.tag}>`,
          elementInfo.text ? `"${elementInfo.text}"` : "",
          elementInfo.href ? `href="${elementInfo.href}..."` : "",
          elementInfo.ariaLabel ? `aria-label="${elementInfo.ariaLabel}"` : "",
          `</${elementInfo.tag}>`,
        ].filter(Boolean).join(" ");
        console.log(`      👆 Clicking #${clickableId}: ${elementDesc}`);

        // Press Escape to clear any stray modals (fast, universal across sites)
        // Note: We don't try to click close buttons - that causes 30s timeout penalties
        // The full page HTML + search context approach handles any modal state
        await page.keyboard.press("Escape").catch(() => {});

        // Capture page state before click for comparison
        const beforeClick = await page.evaluate(() =>
          document.body.innerText.length
        );

        // Use human-like click with natural mouse movement
        const selector = `[data-extract-clickable-id="${clickableId}"]`;
        await humanClick(page, selector);

        await humanWait(page, config.scraperClickWaitTimeout);

        // Check if page content changed after click
        const afterClick = await page.evaluate(() =>
          document.body.innerText.length
        );
        const contentChanged = Math.abs(afterClick - beforeClick) > 100;

        if (!contentChanged) {
          console.warn(
            `      ⚠️  Page content didn't change after click (before: ${beforeClick}, after: ${afterClick})`,
          );
        }

        // Get full page HTML (no modal detection needed - LLM uses search context to identify correct job)
        const jobHtml = await page.content();
        console.log(`      ✓ Captured page HTML (${jobHtml.length} chars)`);

        // Debug: Log first 500 chars of stripped HTML
        if (config.scraperDebugMode) {
          const preview = stripHtmlForLlm(jobHtml).substring(0, 500);
          console.log(`      [DEBUG] HTML preview: ${preview}...`);
        }

        // Build search context to help LLM identify the correct job
        const searchContext: SearchContext = {
          title: searchJobData.title,
          company: searchJobData.company,
          location: searchJobData.location,
        };

        // Extract job data from page (LLM uses search context to find the right job details)
        console.log(
          `      🔍 Extracting job data (context: ${
            searchJobData.title || "unknown"
          } @ ${searchJobData.company || "unknown"})...`,
        );
        const detailJobData = await extractJobData(
          jobHtml,
          pseudoUrl,
          searchContext,
        );

        // Merge search page data with detail page data
        const jobData = mergeJobData(searchJobData, detailJobData);

        // Log final merged job data
        console.log(`      📋 Final job data:`);
        console.log(`         Title: ${jobData.title || "(none)"}`);
        if (jobData.job_poster) {
          console.log(`         Company: ${jobData.job_poster}`);
        }
        if (jobData.location) {
          console.log(`         Location: ${jobData.location}`);
        }
        if (jobData.remote) console.log(`         Remote: ${jobData.remote}`);
        if (jobData.job_type) console.log(`         Type: ${jobData.job_type}`);
        if (jobData.experience_level) {
          console.log(`         Level: ${jobData.experience_level}`);
        }
        if (jobData.skills?.length) {
          console.log(`         Skills: ${jobData.skills.join(", ")}`);
        }
        if (jobData.job_description) {
          console.log(
            `         Description: ${
              jobData.job_description.substring(0, 80)
            }...`,
          );
        }

        // Skip if no meaningful data was extracted (invalid/expired page)
        if (!isValidJob(jobData)) {
          const reason = getJobInvalidReason(jobData);
          console.log(`      ⏭️  Skipping - ${reason}`);
          stats.consecutiveClosedJobs = 0; // Reset counter for invalid pages
          continue;
        }

        // Age check: Mark old jobs as "stale" but still import them
        if (isJobTooOld(jobData.date_posted, config.scraperMaxJobAge)) {
          console.log(
            `      📅 Old job (${jobData.date_posted?.toLocaleDateString()}) - importing as 'stale'`,
          );
          jobData.status = "stale";
          stats.jobsImportedStale++;
        }

        // Status check: Import closed jobs but track them for stop condition
        const isClosed = isJobClosed(jobData.status);
        if (isClosed) {
          console.log(`      📋 Closed job (${jobData.status}) - importing`);
          stats.jobsImportedClosed++;
          stats.consecutiveClosedJobs++;

          // Check stop condition (too many closed jobs in a row = end of active listings)
          const stopCheck = checkStopConditions(stats, {
            maxJobsPerSearch: config.scraperMaxJobsPerSearch,
            consecutiveClosedLimit: config.scraperConsecutiveClosedLimit,
          });
          if (stopCheck.shouldStop) {
            console.log(`\n      🛑 ${stopCheck.reason}`);
            // Still save this last job before stopping
            console.log(`      💾 Saving final job to database...`);
            const result = await upsertJob(jobData, pseudoUrl, platformId);
            const action = result.created ? "Created" : "Updated";
            console.log(`      ✅ ${action} job #${result.id}`);
            stats.jobsProcessed++;
            return {
              jobsProcessed: stats.jobsProcessed,
              strippedHtml: savedStrippedHtml,
            };
          }
        } else {
          // Reset consecutive closed counter for non-closed jobs
          stats.consecutiveClosedJobs = 0;
        }

        // Save job
        console.log(`      💾 Saving to database...`);
        const result = await upsertJob(jobData, pseudoUrl, platformId);

        const action = result.created ? "Created" : "Updated";
        console.log(`      ✅ ${action} job #${result.id}`);
        logJobDetails(jobData, pseudoUrl);

        stats.jobsProcessed++;

        // Check hard limit
        const stopCheck = checkStopConditions(stats, {
          maxJobsPerSearch: config.scraperMaxJobsPerSearch,
          consecutiveClosedLimit: config.scraperConsecutiveClosedLimit,
        });
        if (stopCheck.shouldStop) {
          console.log(`\n      🛑 ${stopCheck.reason}`);
          return {
            jobsProcessed: stats.jobsProcessed,
            strippedHtml: savedStrippedHtml,
          };
        }
      } catch (error) {
        const errMessage = getErrorMessage(error);
        console.error(
          `      ❌ Error processing job ${jobNumber}:`,
          errMessage,
        );

        // Check if this is a fatal error that should stop all scraping
        const err = error instanceof Error ? error : new Error(errMessage);
        if (isFatalScraperError(err)) {
          console.error(
            `\n🛑 Fatal error encountered - stopping scraper: ${errMessage}`,
          );
          return {
            jobsProcessed: stats.jobsProcessed,
            strippedHtml: savedStrippedHtml,
          };
        }

        stats.consecutiveClosedJobs = 0; // Reset on error
        // Continue to next job - don't break entire scrape
      }
    }

    // After processing all jobs on current page, try to load more
    console.log("\n   🔍 Checking for more pages...");
    const paginationInfo = await detectPaginationStrategy(page);

    if (paginationInfo.hasInfiniteScroll || paginationInfo.loadMoreSelector) {
      console.log("      Infinite scroll detected, scrolling...");
      const newContent = await performInfiniteScroll(page, {
        maxScrolls: config.scraperInfiniteScrollMaxScrolls,
      });

      if (newContent === 0) {
        console.log("      No new content after scroll, stopping");
        break;
      }

      // Continue to next iteration to re-detect clickables after scroll
    } else if (paginationInfo.hasPagination) {
      console.log("      Pagination detected, navigating to next page...");
      const hasNext = await navigateToNextPage(page, paginationInfo);

      if (!hasNext) {
        console.log("      No more pages");
        break;
      }

      await humanWait(page, config.scraperRateLimitDelay); // Rate limiting with jitter
    } else {
      console.log("      No pagination detected, stopping");
      break;
    }

    pageNumber++;
  }

  // Final stats
  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅ SPA scraping complete:`);
  console.log(`   Jobs saved: ${stats.jobsProcessed}`);
  console.log(`   Stale (old): ${stats.jobsImportedStale}`);
  console.log(`   Closed: ${stats.jobsImportedClosed}`);
  console.log(`${"═".repeat(60)}\n`);
  return {
    jobsProcessed: stats.jobsProcessed,
    strippedHtml: savedStrippedHtml,
  };
}
