/**
 * Job Import API Endpoint
 * POST /api/jobs/import
 *
 * Imports a single job into the system.
 * Supports both session authentication and API key authentication.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { verifyApiKey } from "$lib/server/auth/api-key";
import { normalizeJobUrl } from "$lib/server/job/normalize-url";
import {
  formatValidationError,
  type JobImportResponse,
  safeValidateJobImport,
} from "$lib/server/job/validation";

/**
 * Get profile ID from session or API key
 */
async function getProfileId(event: {
  locals: App.Locals;
  request: Request;
}): Promise<{ profileId: number | null; error?: string }> {
  // First try session auth
  if (event.locals.user) {
    const profile = await db.profiles.findFirst({
      where: { user_id: event.locals.user.id },
      select: { id: true },
    });

    if (profile) {
      return { profileId: profile.id };
    }
  }

  // Try API key auth
  const apiKey = event.request.headers.get("X-API-Key");
  if (apiKey) {
    const profileId = await verifyApiKey(apiKey);
    if (profileId) {
      return { profileId };
    }
    return { profileId: null, error: "Invalid API key" };
  }

  return { profileId: null, error: "Authentication required" };
}

/**
 * Check if a job with the same normalized URL exists for this profile
 */
async function findExistingJob(
  normalizedUrl: string,
  _profileId: number,
): Promise<{ id: number; job_description: string | null } | null> {
  // Look for existing job by normalized source_url
  // Note: Jobs are global (not profile-scoped) in the current schema
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
 * Import a single job
 */
export const POST: RequestHandler = async (event) => {
  // Step 1: Authenticate
  const { profileId, error: authError } = await getProfileId(event);

  if (!profileId) {
    return json(
      {
        success: false,
        action: "skipped" as const,
        message: authError || "Authentication required",
      } satisfies JobImportResponse,
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
        action: "skipped" as const,
        message: "Invalid JSON in request body",
      } satisfies JobImportResponse,
      { status: 400 },
    );
  }

  const validation = safeValidateJobImport(body);
  if (!validation.success || !validation.data) {
    return json(
      {
        success: false,
        action: "skipped" as const,
        message: formatValidationError(validation.error!),
      } satisfies JobImportResponse,
      { status: 400 },
    );
  }

  const jobData = validation.data;

  // Step 3: Normalize URL for deduplication
  const normalizedUrl = normalizeJobUrl(jobData.sourceUrl);

  // Step 4: Check for existing job
  const existing = await findExistingJob(normalizedUrl, profileId);

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
          location: jobData.location,
          salary_min: jobData.salaryMin,
          salary_max: jobData.salaryMax,
          salary_currency: jobData.salaryCurrency,
          salary_period: jobData.salaryPeriod,
          remote_options: jobData.remote ? [jobData.remote] : undefined,
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

      return json(
        {
          success: true,
          jobId: existing.id,
          action: "updated",
          message: "Job updated successfully",
        } satisfies JobImportResponse,
      );
    }

    // No changes, skip
    return json(
      {
        success: true,
        jobId: existing.id,
        action: "skipped",
        message: "Job already exists with same data",
        duplicateOf: existing.id,
      } satisfies JobImportResponse,
    );
  }

  // Step 5: Create new job
  try {
    const newJob = await db.jobs.create({
      data: {
        title: jobData.title,
        job_poster: jobData.company,
        source_url: normalizedUrl,
        job_description: jobData.description,
        location: jobData.location,
        salary_min: jobData.salaryMin,
        salary_max: jobData.salaryMax,
        salary_currency: jobData.salaryCurrency,
        salary_period: jobData.salaryPeriod,
        remote_options: jobData.remote ? [jobData.remote] : null,
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

    return json(
      {
        success: true,
        jobId: newJob.id,
        action: "created",
        message: "Job imported successfully",
      } satisfies JobImportResponse,
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to create job";

    return json(
      {
        success: false,
        action: "skipped",
        message: errorMessage,
      } satisfies JobImportResponse,
      { status: 500 },
    );
  }
};
