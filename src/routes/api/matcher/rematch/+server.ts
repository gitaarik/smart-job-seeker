/**
 * Rematch API
 *
 * Flags match records for a profile so the matcher re-evaluates them. The rows
 * stay, so the previous score is still shown until the new one lands.
 * Supports filtering by type (no_match / matched) and date posted.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db, queryRaw } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json();
	const profileId = parseInt(body.profileId);
	if (isNaN(profileId)) {
		throw error(400, 'Missing profileId');
	}

	const type: string = body.type || 'no_match'; // "no_match" | "matched"
	const datePostedDays: number | undefined = body.datePostedDays
		? parseInt(body.datePostedDays)
		: undefined;

	// Verify profile belongs to user
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, user.id)),
		columns: { id: true }
	});
	if (!profile) {
		throw error(403, 'Profile not found or not owned by user');
	}

	// Build score condition based on type
	const scoreCondition = type === 'matched' ? sql`jm.score > 0` : sql`jm.score = 0`;

	// Build optional date filter
	const dateCondition = datePostedDays
		? sql`AND j.date_posted >= NOW() - INTERVAL '1 day' * ${datePostedDays}`
		: sql``;

	// Flag rather than delete — see job_matches.rescore_requested_at. The matcher
	// picks up flagged rows and clears the flag once re-scored.
	const result = await queryRaw<{ id: number }[]>(sql`
    UPDATE job_matches jm
    SET rescore_requested_at = NOW()
    FROM jobs j
    WHERE jm.job_id = j.id
      AND jm.profile_id = ${profileId}
      AND ${scoreCondition}
      ${dateCondition}
    RETURNING jm.id
  `);

	return json({ invalidated: result.length });
};
