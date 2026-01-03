/**
 * Job scraping utilities
 */

import { dbDirect as db } from "$lib/db";
import { generateChatCompletion } from "./llm";
import { stripHtmlForLlm } from "./html-strip";
import { interpolatePrompt } from "./ai-chat-utils";
import {
  isValidJobPostingDate,
  parseRelativeDate,
} from "$lib/tools/date-utils";
import { config } from "./config";

/**
 * Normalize URL by removing tracking parameters but preserving job identifiers
 * This helps match jobs even when tracking params change
 * Exported for testing
 */
export function normalizeJobUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // For SPA pseudoUrls (e.g., #job-1, #job-2), preserve the hash fragment
    // This allows us to uniquely identify jobs that appear in modals without real URLs
    const isPseudoUrl = urlObj.hash.match(/^#job-\d+$/);

    if (isPseudoUrl) {
      // Keep the hash for synthetic job identifiers
      return `${urlObj.origin}${urlObj.pathname}${urlObj.hash}`;
    }

    // Preserve important job identifier query parameters
    // These are essential for uniquely identifying jobs on SPAs
    const importantParams = [
      "listingId", // Mercor
      "jobId", // Common pattern
      "id", // Common pattern
      "gh_jid", // Greenhouse
      "lever-jid", // Lever
      "job_id", // Alternative pattern
      "posting", // Alternative pattern
    ];

    const preservedParams = new URLSearchParams();

    for (const param of importantParams) {
      const value = urlObj.searchParams.get(param);
      if (value) {
        preservedParams.set(param, value);
      }
    }

    // Build normalized URL with preserved params
    const queryString = preservedParams.toString();
    const base = `${urlObj.origin}${urlObj.pathname}`;

    return queryString ? `${base}?${queryString}` : base;
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Get platform ID from URL hostname
 * @param url Job URL to extract platform from
 * @returns Platform ID or null if not found
 */
export async function getPlatformIdFromUrl(
  url: string,
): Promise<number | null> {
  try {
    const hostname = new URL(url).hostname;

    // Try to find platform by matching hostname
    const platform = await db.job_platforms.findFirst({
      where: {
        OR: [
          { url: { contains: hostname } },
          { url: { contains: hostname.replace("www.", "") } },
        ],
      },
    });

    return platform?.id ?? null;
  } catch {
    return null;
  }
}

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

  // Check for login/auth indicators
  const loginIndicators = [
    "sign in",
    "log in",
    "authwall",
    "join now",
    "create account",
  ];
  if (
    loginIndicators.some((indicator) => html.toLowerCase().includes(indicator))
  ) {
    warnings.push("Login/authentication page detected");
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

/**
 * Extract job links from search results HTML using LLM
 * @param searchResultsHtml HTML content from job search results page
 * @returns Array of URLs to individual job pages
 */
export async function extractJobLinks(
  searchResultsHtml: string,
): Promise<string[]> {
  // 0. Validate HTML before processing
  const validation = validateJobSearchHtml(searchResultsHtml);

  if (!validation.isValid) {
    console.warn("⚠️  HTML validation warnings:", validation.warnings);

    // Check for login page - this is a hard stop
    const hasLoginWarning = validation.warnings.some((w) =>
      w.toLowerCase().includes("login") ||
      w.toLowerCase().includes("authentication")
    );

    if (hasLoginWarning) {
      throw new Error(
        "Login/authentication page detected. Please log in manually in the browser and run the scraper again.",
      );
    }

    // Continue anyway for other warnings - might still extract something useful
  }

  // 1. Strip HTML to minimal content
  const strippedHtml = stripHtmlForLlm(searchResultsHtml);

  // 2. Get prompt template
  const template = await db.ai_chat_prompts.findUnique({
    where: { request: "extract_job_links" },
  });

  if (!template) {
    throw new Error("Prompt template 'extract_job_links' not found");
  }

  // 3. Interpolate variables
  const systemPrompt = template.system_prompt || "";
  const userPrompt = interpolatePrompt(template.user_prompt || "", {
    html: strippedHtml,
  });

  // 4. Call LLM using generic utility with optional structured output
  const responseFormat = template.format
    ? {
      type: "json_schema" as const,
      json_schema: {
        name: "job_links",
        strict: true,
        schema: template.format as Record<string, any>,
      },
    }
    : undefined;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.3, responseFormat },
  );

  // 5. Parse JSON response
  try {
    const result = JSON.parse(response);

    // Extract urls array from the structured response
    // Try multiple possible field names for compatibility
    const links = result.urls || result.job_urls || result.links;

    if (!Array.isArray(links)) {
      throw new Error(
        `LLM response doesn't contain a valid array. Expected 'urls', 'job_urls', or 'links' field. Got: ${
          JSON.stringify(result)
        }`,
      );
    }

    return links;
  } catch (error) {
    console.error("Failed to parse job links from LLM response:", error);
    console.error("Response was:", response);
    throw new Error(
      `Failed to extract job links: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
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
      .filter((id) => id > 0);
    console.log(
      `      Found ${allClickableIds.length} data-extract-clickable-id attributes in stripped HTML`,
    );
    console.log(`      All IDs: [${allClickableIds.join(", ")}]`);
  } else {
    console.warn(
      "      ⚠️  No data-extract-clickable-id attributes found in stripped HTML!",
    );
  }

  // 2. Get prompt template
  const template = await db.ai_chat_prompts.findUnique({
    where: { request: "extract_jobs_from_search_page" },
  });

  if (!template) {
    throw new Error(
      "Prompt template 'extract_jobs_from_search_page' not found in database",
    );
  }

  // 3. Run LLM extraction
  try {
    const systemPrompt = interpolatePrompt(template.system_prompt, {});
    const userPrompt = interpolatePrompt(template.user_prompt, {
      html: strippedSearchResultsHtml,
    });

    console.log("      🤖 Running LLM to extract job data from search page...");

    const result = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.3,
        responseFormat: template.format
          ? {
            type: "json_schema" as const,
            json_schema: {
              name: "job_extraction",
              strict: true,
              schema: template.format as Record<string, any>,
            },
          }
          : undefined,
      },
    );

    // Validate LLM response structure
    if (result && Array.isArray(result.jobs)) {
      console.log(
        `      ✓ LLM extracted ${result.jobs.length} jobs from search page`,
      );

      // CRITICAL: Validate that LLM IDs actually exist in the page
      const validJobs = result.jobs.filter((job: any) => {
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
          result.jobs.length - validJobs.length
        } hallucinated)`,
      );

      // If all IDs were hallucinated, throw error
      if (validJobs.length === 0 && result.jobs.length > 0) {
        throw new Error(
          `All ${result.jobs.length} LLM-extracted IDs were hallucinated (not found in page)`,
        );
      }

      return {
        jobs: validJobs,
      };
    } else {
      throw new Error("LLM response missing 'jobs' array");
    }
  } catch (error) {
    // Log the error and abort the import
    console.error(
      `      ❌ LLM extraction failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw error;
  }
}

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
    title: string;
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

/**
 * Detect if a page is a login page using LLM
 * Currently unused but available for future login detection needs
 * @param pageHtml HTML content of the page
 * @returns Boolean indicating if it's a login page
 */
async function detectLoginPage(pageHtml: string): Promise<boolean> {
  // 1. Strip HTML to minimal content
  const strippedHtml = stripHtmlForLlm(pageHtml);

  // 2. Get prompt template
  const template = await db.ai_chat_prompts.findUnique({
    where: { request: "detect_login_page" },
  });

  if (!template) {
    throw new Error("Prompt template 'detect_login_page' not found");
  }

  // 3. Interpolate variables
  const systemPrompt = template.system_prompt || "";
  const userPrompt = interpolatePrompt(template.user_prompt || "", {
    html: strippedHtml,
  });

  // 4. Prepare structured output format
  const responseFormat = template.format
    ? {
      type: "json_schema" as const,
      json_schema: {
        name: "login_detection",
        strict: true,
        schema: template.format as Record<string, any>,
      },
    }
    : undefined;

  // 5. Call LLM
  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.3, responseFormat },
  );

  // 6. Parse response
  try {
    const result = JSON.parse(response);
    return result.isLoginPage === true;
  } catch (error) {
    console.error("Failed to parse login detection from LLM response:", error);
    console.error("Response was:", response);
    throw new Error(
      `Failed to detect login page: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Format salary information for display
 */
function formatSalary(data: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
}): string | null {
  if (!data.salary_min && !data.salary_max) {
    return null;
  }

  const currency = data.salary_currency || "USD";
  const period = data.salary_period || "year";

  if (data.salary_min && data.salary_max) {
    return `${currency} ${data.salary_min.toLocaleString()} - ${data.salary_max.toLocaleString()} per ${period}`;
  } else if (data.salary_min) {
    return `${currency} ${data.salary_min.toLocaleString()}+ per ${period}`;
  } else if (data.salary_max) {
    return `Up to ${currency} ${data.salary_max.toLocaleString()} per ${period}`;
  }

  return null;
}

/**
 * Extract job data from job posting HTML using LLM
 * @param jobHtml HTML content from individual job page
 * @param sourceUrl URL of the job page
 * @returns Parsed job data
 */
export async function extractJobData(
  jobHtml: string,
  sourceUrl: string,
): Promise<{
  title: string;
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

  // 3. Get prompt template
  const template = await db.ai_chat_prompts.findUnique({
    where: { request: "extract_job_data" },
  });

  if (!template) {
    throw new Error("Prompt template 'extract_job_data' not found");
  }

  // 4. Interpolate variables
  const systemPrompt = template.system_prompt || "";
  const userPrompt = interpolatePrompt(template.user_prompt || "", {
    html: strippedHtml,
  });

  // 5. Call LLM using generic utility with optional structured output
  const responseFormat = template.format
    ? {
      type: "json_schema" as const,
      json_schema: {
        name: "job_data",
        strict: true,
        schema: template.format as Record<string, any>,
      },
    }
    : undefined;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.3, responseFormat },
  );

  // 6. Parse JSON response
  try {
    const data = JSON.parse(response);

    // Debug: Log extracted data
    console.log("Extracted job data:", {
      title: data.title,
      company: data.job_poster,
      location: data.location,
      date_posted: data.date_posted || null,
      salary: formatSalary(data),
      remote: data.remote,
      job_type: data.job_type,
      experience_level: data.experience_level,
      skills: data.skills,
      status: data.status,
    });

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

    // 9. Apply fallback for title if LLM extraction failed or returned empty
    const effectiveTitle = (data.title && data.title.trim() !== "")
      ? data.title
      : "Untitled Position";

    // 10. Include stripped HTML in return value for database storage
    return {
      ...data,
      title: effectiveTitle,
      source_html_stripped: strippedHtml,
    };
  } catch (error) {
    console.error("Failed to parse job data from LLM response:", error);
    console.error("Response was:", response);
    throw new Error(
      `Failed to extract job data from ${sourceUrl}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Create or update job in database
 * @param jobData Job data extracted by Browser-Use
 * @param sourceUrl URL where the job was found
 * @param platformId ID of the job platform (from job_platforms table)
 * @returns Object with job ID and whether it was created or updated
 */
export async function upsertJob(
  jobData: {
    title: string;
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
  },
  sourceUrl: string,
  platformId: number | null,
): Promise<{ id: number; created: boolean }> {
  // Normalize URL to match jobs regardless of tracking params
  const normalizedUrl = normalizeJobUrl(sourceUrl);

  // Check if job exists by normalized source_url
  const existing = await db.jobs.findFirst({
    where: { source_url: normalizedUrl },
  });

  const currentDate = new Date();

  // Use platform name as fallback if job_poster is null/empty
  let effectiveJobPoster = jobData.job_poster;

  if (
    (!jobData.job_poster || jobData.job_poster.trim() === "") &&
    platformId !== null
  ) {
    const platform = await db.job_platforms.findUnique({
      where: { id: platformId },
      select: { name: true },
    });

    if (platform) {
      effectiveJobPoster = platform.name;
      console.log(`Using platform name as job_poster: ${platform.name}`);
    }
  }

  // Default status to "hiring" if not explicitly set
  // Assumption: if a job is posted and not explicitly closed, it's hiring
  const effectiveStatus = jobData.status || "hiring";

  // Convert single values to arrays for multi-select JSON fields
  // Remove the single-value fields and use multi-select fields instead
  const {
    remote,
    job_type,
    experience_level,
    skills,
    job_poster: _,
    status: __,
    ...baseJobData
  } = jobData as typeof jobData & { source_html_stripped?: string };

  const multiSelectData = {
    remote_options: remote ? [remote] : null,
    job_types: job_type ? [job_type] : null,
    experience_levels: experience_level ? [experience_level] : null,
  };

  if (existing) {
    // Update existing
    console.log(
      `Updating existing job #${existing.id} (scrape count: ${
        existing.scrape_count || 0
      } -> ${(existing.scrape_count || 0) + 1})`,
    );
    console.log("Update data:", {
      status: effectiveStatus,
      job_poster: effectiveJobPoster,
      remote_options: multiSelectData.remote_options,
      job_types: multiSelectData.job_types,
      experience_levels: multiSelectData.experience_levels,
    });

    await db.jobs.update({
      where: { id: existing.id },
      data: {
        ...baseJobData,
        ...multiSelectData,
        job_poster: effectiveJobPoster,
        status: effectiveStatus,
        skills,
        import_error: null,
        last_scraped: currentDate,
        scrape_count: (existing.scrape_count || 0) + 1,
        date_updated: currentDate,
      },
    });
    return { id: existing.id, created: false };
  } else {
    // Create new
    console.log("Creating new job");
    const newJob = await db.jobs.create({
      data: {
        ...baseJobData,
        ...multiSelectData,
        job_poster: effectiveJobPoster,
        status: effectiveStatus,
        skills,
        source_url: normalizedUrl, // Use normalized URL
        job_platform: platformId,
        last_scraped: currentDate,
        scrape_count: 1,
        date_created: currentDate,
        date_updated: currentDate,
      },
    });
    return { id: newJob.id, created: true };
  }
}
