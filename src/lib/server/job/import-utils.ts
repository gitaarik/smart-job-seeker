/**
 * Shared utilities for job import endpoints
 */

import { db } from "$lib/server/db";
import { verifyApiKey } from "$lib/server/auth/api-key";

/**
 * Get profile ID from API key in request headers
 */
export async function getProfileIdFromApiKey(
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
export async function findExistingJob(
  normalizedUrl: string,
): Promise<{ id: number; job_description: string | null } | null> {
  return db.query.jobs.findFirst({
    where: { source_url: normalizedUrl },
    select: { id: true, job_description: true },
  });
}
