/**
 * Match trigger for newly imported jobs.
 *
 * Called from the import paths (direct API + scrape upsert) right after a
 * (job, profile) pairing is recorded in job_importers. Decides whether to
 * enqueue a match job, so the score appears within seconds instead of waiting
 * up to MATCHER_INTERVAL_SECONDS for the background loop.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { job_matches, match_config } from '$lib/server/db/schema';
import { enqueueMatchJob } from '$lib/server/queue/match-queue';

export async function triggerMatchForImport(profileId: number, jobId: number): Promise<void> {
	try {
		const [existingMatch, hasConfig] = await Promise.all([
			db.query.job_matches.findFirst({
				where: and(eq(job_matches.profile_id, profileId), eq(job_matches.job_id, jobId)),
				columns: { id: true }
			}),
			db.query.match_config.findFirst({
				where: eq(match_config.profile_id, profileId),
				columns: { id: true }
			})
		]);
		if (existingMatch || !hasConfig) return;
		await enqueueMatchJob({ profileId, jobId, triggeredBy: 'system' });
	} catch (err) {
		console.warn(`[match-trigger] failed for profile=${profileId} job=${jobId}:`, err);
	}
}
