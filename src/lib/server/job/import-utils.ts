/**
 * Shared utilities for job import endpoints
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { jobs } from "$lib/server/db/schema";
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
  const result = await db.query.jobs.findFirst({
    where: eq(jobs.source_url, normalizedUrl),
    columns: { id: true, job_description: true },
  });
  return result ?? null;
}
