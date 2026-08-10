/**
 * Shared utilities for job import endpoints
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { jobs, job_importers } from '$lib/server/db/schema';
import { verifyApiKey } from '$lib/server/auth/api-key';
import { triggerMatchForImport } from '$lib/server/job/match-trigger';

/**
 * Get profile ID from API key in request headers
 */
export async function getProfileIdFromApiKey(
	request: Request
): Promise<{ profileId: number | null; error?: string }> {
	const apiKey = request.headers.get('X-API-Key');
	if (apiKey) {
		const profileId = await verifyApiKey(apiKey);
		if (profileId) {
			return { profileId };
		}
		return { profileId: null, error: 'Invalid device key' };
	}

	return { profileId: null, error: 'Device key required' };
}

/**
 * Check if a job with the same normalized URL exists
 */
export async function findExistingJob(
	normalizedUrl: string
): Promise<{ id: number; job_description: string | null } | null> {
	const result = await db.query.jobs.findFirst({
		where: eq(jobs.source_url, normalizedUrl),
		columns: { id: true, job_description: true }
	});
	return result ?? null;
}

/**
 * Record who imported a job, then queue matching for them.
 *
 * `job_importers` has a unique index on (job_id, profile_id), so let the
 * database settle the "already recorded?" question — a read-then-insert can
 * lose the race against a concurrent import of the same job and throw.
 */
export async function recordImporter(jobId: number, profileId: number): Promise<void> {
	await db
		.insert(job_importers)
		.values({ job_id: jobId, profile_id: profileId })
		.onConflictDoNothing({ target: [job_importers.job_id, job_importers.profile_id] });
	await triggerMatchForImport(profileId, jobId);
}
