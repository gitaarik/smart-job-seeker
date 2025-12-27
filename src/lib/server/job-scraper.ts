/**
 * Job scraping and LLM extraction logic
 */

import { generateChatCompletion } from "./llm";
import { stripHtmlForLlm } from "./html-strip";
import { interpolatePrompt } from "./ai-chat-utils";
import { dbDirect as db } from "$lib/db";

/**
 * Extract job links from search results HTML using LLM
 * @param searchResultsHtml HTML content from job search results page
 * @returns Array of URLs to individual job pages
 */
export async function extractJobLinks(
  searchResultsHtml: string,
): Promise<string[]> {
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
  strippedHtml: string;
}> {
  // 1. Strip HTML to minimal content
  const strippedHtml = stripHtmlForLlm(jobHtml);

  // 2. Get prompt template
  const template = await db.ai_chat_prompts.findUnique({
    where: { request: "extract_job_data" },
  });

  if (!template) {
    throw new Error("Prompt template 'extract_job_data' not found");
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

  // 5. Parse JSON response
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

    // 6. Convert date_posted to Date object if present
    if (data.date_posted) {
      data.date_posted = new Date(data.date_posted);
    }

    // 7. Include stripped HTML in return value
    return {
      ...data,
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
 * Normalize URL by removing query parameters and fragments
 * This helps match jobs even when tracking params change
 */
function normalizeJobUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Return just the origin + pathname (no query params or fragments)
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Create or update job in database
 * @param jobData Job data extracted from HTML
 * @param sourceUrl URL where the job was found
 * @param importSource Name of the job site (e.g., "LinkedIn")
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
    strippedHtml: string;
  },
  sourceUrl: string,
  importSource: string,
): Promise<{ id: number; created: boolean }> {
  // Normalize URL to match jobs regardless of tracking params
  const normalizedUrl = normalizeJobUrl(sourceUrl);

  // Check if job exists by normalized source_url
  const existing = await db.jobs.findFirst({
    where: { source_url: normalizedUrl },
  });

  const currentDate = new Date();

  // Convert single values to arrays for multi-select JSON fields
  // Remove the single-value fields and use multi-select fields instead
  const {
    remote,
    job_type,
    experience_level,
    skills,
    strippedHtml,
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
      remote_options: multiSelectData.remote_options,
      job_types: multiSelectData.job_types,
      experience_levels: multiSelectData.experience_levels,
    });

    await db.jobs.update({
      where: { id: existing.id },
      data: {
        ...baseJobData,
        ...multiSelectData,
        skills,
        source_html_stripped: strippedHtml,
        import_status: "published",
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
        skills,
        source_html_stripped: strippedHtml,
        source_url: normalizedUrl, // Use normalized URL
        import_source: importSource,
        import_status: "published",
        status: "published",
        last_scraped: currentDate,
        scrape_count: 1,
        date_created: currentDate,
        date_updated: currentDate,
      },
    });
    return { id: newJob.id, created: true };
  }
}
