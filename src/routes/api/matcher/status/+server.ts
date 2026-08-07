/**
 * Matcher Status API
 *
 * Returns matcher progress: total jobs, matched count, unmatched count,
 * recently matched jobs, and current matcher state from Redis.
 *
 * Uses shared match counting queries from match-counts.ts — the same
 * single source of truth used by the match progress page.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, ne, desc } from 'drizzle-orm';
import { profiles, match_config, job_matches } from '$lib/server/db/schema';
import { getMatcherState, isMatcherAlive } from '$lib/server/job/matcher-state';
import { getMatchCounts, getEligibleUnmatchedCount } from '$lib/server/job/match-counts';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const profileId = parseInt(url.searchParams.get('profileId') || '');
	if (isNaN(profileId)) {
		throw error(400, 'Missing profileId parameter');
	}

	const includeIneligible = url.searchParams.get('includeIneligible') === 'true';

	// Verify profile belongs to user
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, user.id)),
		columns: { id: true }
	});
	if (!profile) {
		throw error(403, 'Profile not found or not owned by user');
	}

	// Load matcher config
	const matchConfigRecord = await db.query.match_config.findFirst({
		where: eq(match_config.profile_id, profileId)
	});

	const matchCommunityJobs = matchConfigRecord?.match_community_jobs ?? false;
	const communityMaxAgeDays =
		((matchConfigRecord as Record<string, unknown> | null)?.community_max_age_days as
			number | null) ?? null;

	// Build where condition for recent matches
	const recentMatchesWhere = includeIneligible
		? eq(job_matches.profile_id, profileId)
		: and(eq(job_matches.profile_id, profileId), ne(job_matches.recommendation, 'ineligible'));

	// Run all queries in parallel
	const [counts, eligibleUnmatched, matcherState, matcherAlive, recentMatches] = await Promise.all([
		getMatchCounts(profileId, matchCommunityJobs, communityMaxAgeDays),
		getEligibleUnmatchedCount(
			profileId,
			matchCommunityJobs,
			matchConfigRecord
				? { ...matchConfigRecord, community_max_age_days: communityMaxAgeDays }
				: null
		),
		getMatcherState(profileId),
		isMatcherAlive(),
		db.query.job_matches.findMany({
			where: recentMatchesWhere,
			orderBy: desc(job_matches.date_created),
			limit: 20,
			columns: {
				id: true,
				job_id: true,
				score: true,
				recommendation: true,
				date_created: true,
				skill_match_percentage: true,
				match_summary: true
			},
			with: {
				job: {
					columns: {
						id: true,
						title: true,
						company: true,
						office_location: true,
						job_types: true,
						work_location: true
					}
				}
			}
		})
	]);

	return json({
		...counts,
		eligibleUnmatched,
		matcherState,
		matcherAlive,
		recentMatches
	});
};
