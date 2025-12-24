/**
 * Job scraping and LLM extraction logic
 */

import { generateChatCompletion } from "./llm";
import { stripHtmlForLlm } from "./html-strip";
import { interpolatePrompt } from "./ai-chat-utils";
import { db } from "$lib/db";

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
    const links = JSON.parse(response);

    if (!Array.isArray(links)) {
      throw new Error("LLM response is not an array");
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
  salary_range: string | null;
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

    // 6. Convert date_posted to Date object if present
    if (data.date_posted) {
      data.date_posted = new Date(data.date_posted);
    }

    return data;
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
    salary_range: string | null;
  },
  sourceUrl: string,
  importSource: string,
): Promise<{ id: number; created: boolean }> {
  // Check if job exists by source_url
  const existing = await db.jobs.findFirst({
    where: { source_url: sourceUrl },
  });

  const currentDate = new Date();

  if (existing) {
    // Update existing
    await db.jobs.update({
      where: { id: existing.id },
      data: {
        ...jobData,
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
    const newJob = await db.jobs.create({
      data: {
        ...jobData,
        source_url: sourceUrl,
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
