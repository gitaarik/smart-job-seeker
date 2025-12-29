/**
 * Job scraping and LLM extraction logic
 */

import { generateChatCompletion } from "./llm";
import { stripHtmlForLlm } from "./html-strip";
import { interpolatePrompt } from "./ai-chat-utils";
import { dbDirect as db } from "$lib/db";
import {
  isValidJobPostingDate,
  parseRelativeDate,
} from "$lib/tools/date-utils";

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
    // Continue anyway - might still extract something useful
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
    const links = result.urls;

    if (!Array.isArray(links)) {
      throw new Error("LLM response.urls is not an array");
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
 * Extract clickable element IDs for job cards from search results HTML using LLM
 * Used for SPA sites where jobs don't have direct URLs
 * @param searchResultsHtml HTML with data-clickable-id markers already injected
 * @returns Object with clickable IDs, pattern description, and job count
 */
export async function extractJobClickSelectors(
  searchResultsHtml: string,
): Promise<{
  clickableIds: number[];
  pattern: string;
  jobCount: number;
}> {
  // 1. Strip HTML to minimal content (data-clickable-id attributes survive)
  const strippedHtml = stripHtmlForLlm(searchResultsHtml);

  // 2. Get prompt template
  const template = await db.ai_chat_prompts.findUnique({
    where: { request: "extract_job_click_selectors" },
  });

  if (!template) {
    throw new Error("Prompt template 'extract_job_click_selectors' not found");
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
        name: "job_click_selectors",
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

    if (!Array.isArray(result.clickableIds)) {
      throw new Error("LLM response.clickableIds is not an array");
    }

    return {
      clickableIds: result.clickableIds,
      pattern: result.pattern || "Job cards pattern",
      jobCount: result.jobCount || result.clickableIds.length,
    };
  } catch (error) {
    console.error(
      "Failed to parse click selectors from LLM response:",
      error,
    );
    console.error("Response was:", response);
    throw new Error(
      `Failed to extract click selectors: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Detect if a page is a login page using LLM
 * @param pageHtml HTML content of the page
 * @returns Boolean indicating if it's a login page
 */
export async function detectLoginPage(pageHtml: string): Promise<boolean> {
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
  options?: {
    fallbackTitle?: string | null;
  },
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
  strippedHtml: string;
}> {
  // 1. Strip HTML to minimal content
  const strippedHtml = stripHtmlForLlm(jobHtml);

  // 2. Check for invalid/closed job pages (Mercor-specific)
  // These pages redirect to notification/welcome pages instead of showing job content
  if (
    strippedHtml.includes("Welcome to Mercor") &&
    strippedHtml.includes("Visit the Mercor Explore Page")
  ) {
    throw new Error("Invalid job page - redirected to notification page");
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

    // 7. Parse and validate date_posted
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

    // 8. Apply fallback for title if LLM extraction failed or returned empty
    const effectiveTitle = (data.title && data.title.trim() !== "")
      ? data.title
      : (options?.fallbackTitle || data.title);

    // 9. Include stripped HTML in return value
    return {
      ...data,
      title: effectiveTitle,
      strippedHtml,
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
 * Create or update job in database
 * @param jobData Job data extracted from HTML
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
    strippedHtml: string;
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
    strippedHtml,
    job_poster: _,
    status: __,
    ...baseJobData
  } = jobData;

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
        source_html_stripped: strippedHtml,
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
        source_html_stripped: strippedHtml,
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
