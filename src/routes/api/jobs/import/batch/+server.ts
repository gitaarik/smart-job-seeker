/**
 * Batch Job Import API Endpoint
 * POST /api/jobs/import/batch
 *
 * Imports multiple jobs into the system (max 100 per request).
 * Requires API key authentication via X-API-Key header.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { verifyApiKey } from "$lib/server/auth/api-key";
import { normalizeJobUrl } from "$lib/server/job/normalize-url";
import {
  type BatchJobImportResponse,
  formatValidationError,
  type JobImportRequest,
  type JobImportResponse,
  safeValidateBatchJobImport,
} from "$lib/server/job/validation";

/**
 * Get profile ID from API key
 */
async function getProfileId(
  request: Request,
): Promise<{ profileId: number | null; error?: string }> {
  const apiKey = request.headers.get("X-API-Key");
  if (apiKey) {
    const profileId = await verifyApiKey(apiKey);
    if (profileId) {
      return { profileId };
    }
    return { profileId: null, error: "Invalid API key" };
  }

  return { profileId: null, error: "API key required" };
}

/**
 * Check if a job with the same normalized URL exists
 */
async function findExistingJob(
  normalizedUrl: string,
): Promise<{ id: number; job_description: string | null } | null> {
  const existing = await db.jobs.findFirst({
    where: {
      source_url: normalizedUrl,
    },
    select: {
      id: true,
      job_description: true,
    },
  });

  return existing;
}

/**
 * Import a single job and return the result
 */
async function importSingleJob(
  jobData: JobImportRequest,
  _profileId: number,
): Promise<JobImportResponse> {
  // Normalize URL for deduplication
  const normalizedUrl = normalizeJobUrl(jobData.sourceUrl);

  // Check for existing job
  const existing = await findExistingJob(normalizedUrl);

  if (existing) {
    // Check if data has changed
    const hasChanges = jobData.description &&
      jobData.description !== existing.job_description;

    if (hasChanges) {
      // Update existing job
      await db.jobs.update({
        where: { id: existing.id },
        data: {
          title: jobData.title,
          job_poster: jobData.company,
          job_description: jobData.description,
          office_location: jobData.location,
          salary_min: jobData.salaryMin,
          salary_max: jobData.salaryMax,
          salary_currency: jobData.salaryCurrency,
          salary_period: jobData.salaryPeriod,
          work_location: jobData.remote ? [jobData.remote] : undefined,
          job_types: jobData.jobType ? [jobData.jobType] : undefined,
          experience_levels: jobData.experienceLevel
            ? [jobData.experienceLevel]
            : undefined,
          skills_required: jobData.skills,
          date_posted: jobData.postedAt
            ? new Date(jobData.postedAt)
            : undefined,
          job_platform: jobData.platformId,
          date_updated: new Date(),
        },
      });

      return {
        success: true,
        jobId: existing.id,
        action: "updated",
        message: "Job updated successfully",
      };
    }

    // No changes, skip
    return {
      success: true,
      jobId: existing.id,
      action: "skipped",
      message: "Job already exists with same data",
      duplicateOf: existing.id,
    };
  }

  // Create new job
  try {
    const newJob = await db.jobs.create({
      data: {
        title: jobData.title,
        job_poster: jobData.company,
        source_url: normalizedUrl,
        job_description: jobData.description,
        office_location: jobData.location,
        salary_min: jobData.salaryMin,
        salary_max: jobData.salaryMax,
        salary_currency: jobData.salaryCurrency,
        salary_period: jobData.salaryPeriod,
        work_location: jobData.remote ? [jobData.remote] : null,
        job_types: jobData.jobType ? [jobData.jobType] : null,
        experience_levels: jobData.experienceLevel
          ? [jobData.experienceLevel]
          : null,
        skills_required: jobData.skills,
        date_posted: jobData.postedAt ? new Date(jobData.postedAt) : null,
        job_platform: jobData.platformId,
        status: "hiring",
        date_created: new Date(),
        date_updated: new Date(),
      },
    });

    return {
      success: true,
      jobId: newJob.id,
      action: "created",
      message: "Job imported successfully",
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to create job";

    return {
      success: false,
      action: "skipped",
      message: errorMessage,
    };
  }
}

/**
 * Batch import jobs
 */
export const POST: RequestHandler = async (event) => {
  // Step 1: Authenticate
  const { profileId, error: authError } = await getProfileId(event.request);

  if (!profileId) {
    return json(
      {
        success: false,
        summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
        results: [],
        message: authError || "Authentication required",
      },
      { status: 401 },
    );
  }

  // Step 2: Parse and validate request body
  let body: unknown;
  try {
    body = await event.request.json();
  } catch {
    return json(
      {
        success: false,
        summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
        results: [],
        message: "Invalid JSON in request body",
      },
      { status: 400 },
    );
  }

  const validation = safeValidateBatchJobImport(body);
  if (!validation.success || !validation.data) {
    return json(
      {
        success: false,
        summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
        results: [],
        message: formatValidationError(validation.error!),
      },
      { status: 400 },
    );
  }

  const { jobs } = validation.data;

  // Step 3: Process each job
  const results: JobImportResponse[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const jobData of jobs) {
    try {
      const result = await importSingleJob(jobData, profileId);
      results.push(result);

      switch (result.action) {
        case "created":
          created++;
          break;
        case "updated":
          updated++;
          break;
        case "skipped":
          if (result.success) {
            skipped++;
          } else {
            failed++;
          }
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      results.push({
        success: false,
        action: "skipped",
        message: errorMessage,
      });
      failed++;
    }
  }

  // Step 4: Return summary
  const response: BatchJobImportResponse = {
    success: failed === 0,
    summary: {
      total: jobs.length,
      created,
      updated,
      skipped,
      failed,
    },
    results,
  };

  return json(response);
};
