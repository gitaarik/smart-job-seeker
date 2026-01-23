/**
 * Job data processing and database operations
 * Contains: URL normalization, platform lookup, job upsert, salary formatting
 */

import { dbDirect as db } from "$lib/db";

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format salary for display
 * @returns Formatted salary string or "-" if no salary data
 */
export function formatSalary(data: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
}): string {
  if (!data.salary_min && !data.salary_max) return "-";
  const min = data.salary_min?.toLocaleString() || "?";
  const max = data.salary_max?.toLocaleString() || "?";
  const curr = data.salary_currency || "";
  const period = data.salary_period ? `/${data.salary_period}` : "";
  return `${curr}${min}-${max}${period}`;
}

/**
 * Result of upserting a job
 */
export interface UpsertResult {
  id?: number;
  created?: boolean;
  skipped?: boolean;
  skipReason?: string;
  changes?: {
    status?: { old: string | null; new: string | null };
    description?: boolean;
    skills?: { added: string[]; removed: string[] };
    salary?: { old: string; new: string };
  };
}

// ============================================================================
// URL Processing
// ============================================================================

/**
 * Normalize URL by removing tracking parameters but preserving job identifiers
 * This helps match jobs even when tracking params change
 * Exported for testing
 */
export function normalizeJobUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // For SPA pseudoUrls (e.g., #job-1, #spa-job-1), preserve the hash fragment
    // This allows us to uniquely identify jobs that appear in modals without real URLs
    const isPseudoUrl = urlObj.hash.match(/^#(?:spa-)?job-\d+$/);

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

// ============================================================================
// Platform Lookup
// ============================================================================

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

// ============================================================================
// Database Operations
// ============================================================================

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
    source_html_stripped?: string | null;
    ai_chat_extraction?: number | null;
  },
  sourceUrl: string,
  platformId: number | string | null,
): Promise<UpsertResult> {
  // Normalize URL for storage (not used for matching)
  const normalizedUrl = normalizeJobUrl(sourceUrl);

  // Ensure platformId is a number or null
  const numericPlatformId = platformId !== null ? Number(platformId) : null;

  const currentDate = new Date();

  // Determine job_poster (fallback to platform name)
  let effectiveJobPoster = jobData.job_poster?.trim() || null;

  if (!effectiveJobPoster && numericPlatformId !== null) {
    const platform = await db.job_platforms.findUnique({
      where: { id: numericPlatformId },
      select: { name: true },
    });

    if (platform) {
      effectiveJobPoster = platform.name;
      console.log(`      Using platform name as job_poster: ${platform.name}`);
    }
  }

  // Validate required fields for uniqueness
  const title = jobData.title?.trim();
  if (!title || !effectiveJobPoster) {
    return {
      skipped: true,
      skipReason: `Missing required fields for uniqueness: ${
        !title ? "title" : "job_poster"
      }`,
    };
  }

  // Determine date for matching (fallback to date_created for first import)
  const dateForMatching = jobData.date_posted || currentDate;

  // Match by content: title + job_poster + date_posted
  const existing = await db.jobs.findFirst({
    where: {
      title: title,
      job_poster: effectiveJobPoster,
      date_posted: dateForMatching,
    },
  });

  // Default status to "hiring" if not explicitly set
  // Assumption: if a job is posted and not explicitly closed, it's hiring
  const effectiveStatus = jobData.status || "hiring";

  // Convert single values to arrays for multi-select JSON fields
  // Explicitly whitelist allowed database fields to avoid Browser-Use metadata
  const baseJobData = {
    title: title, // Use validated title
    job_description: jobData.job_description,
    company_description: jobData.company_description,
    date_posted: dateForMatching, // Use date with fallback (for uniqueness)
    location: jobData.location,
    salary_min: jobData.salary_min,
    salary_max: jobData.salary_max,
    salary_currency: jobData.salary_currency,
    salary_period: jobData.salary_period,
    source_html_stripped: jobData.source_html_stripped || null,
  };

  const multiSelectData = {
    remote_options: jobData.remote ? [jobData.remote] : null,
    job_types: jobData.job_type ? [jobData.job_type] : null,
    experience_levels: jobData.experience_level
      ? [jobData.experience_level]
      : null,
  };

  if (existing) {
    // Detect changes before updating
    const changes: UpsertResult["changes"] = {};

    // Status change
    if (existing.status !== effectiveStatus) {
      changes.status = { old: existing.status, new: effectiveStatus };
    }

    // Description change (just flag, don't compare full text)
    if (
      jobData.job_description &&
      existing.job_description !== jobData.job_description
    ) {
      changes.description = true;
    }

    // Skills change
    const oldSkills = (existing.skills as string[] | null) || [];
    const newSkills = jobData.skills || [];
    const added = newSkills.filter((s) => !oldSkills.includes(s));
    const removed = oldSkills.filter((s) => !newSkills.includes(s));
    if (added.length > 0 || removed.length > 0) {
      changes.skills = { added, removed };
    }

    // Salary change
    const oldSalary = formatSalary({
      salary_min: existing.salary_min,
      salary_max: existing.salary_max,
      salary_currency: existing.salary_currency,
      salary_period: existing.salary_period,
    });
    const newSalary = formatSalary(jobData);
    if (oldSalary !== newSalary && newSalary !== "-") {
      changes.salary = { old: oldSalary, new: newSalary };
    }

    await db.jobs.update({
      where: { id: existing.id },
      data: {
        ...baseJobData,
        ...multiSelectData,
        job_poster: effectiveJobPoster,
        status: effectiveStatus,
        skills: jobData.skills,
        ai_chat_extraction: jobData.ai_chat_extraction,
        import_error: null,
        last_scraped: currentDate,
        scrape_count: (existing.scrape_count || 0) + 1,
        date_updated: currentDate,
      },
    });

    return {
      id: existing.id,
      created: false,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    };
  } else {
    const newJob = await db.jobs.create({
      data: {
        ...baseJobData,
        ...multiSelectData,
        job_poster: effectiveJobPoster,
        status: effectiveStatus,
        skills: jobData.skills,
        ai_chat_extraction: jobData.ai_chat_extraction,
        source_url: normalizedUrl, // Use normalized URL
        job_platform: numericPlatformId,
        last_scraped: currentDate,
        scrape_count: 1,
        date_created: currentDate,
        date_updated: currentDate,
      },
    });
    return { id: newJob.id, created: true };
  }
}
