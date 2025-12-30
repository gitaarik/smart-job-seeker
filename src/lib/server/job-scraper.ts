/**
 * Job scraping utilities
 */

import { dbDirect as db } from "$lib/db";

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
