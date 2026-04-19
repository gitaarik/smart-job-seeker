/**
 * Matcher Status API
 *
 * Returns matcher progress: total jobs, matched count, unmatched count,
 * recently matched jobs, and current matcher state from Redis.
 *
 * Uses shared match counting queries from match-counts.ts — the same
 * single source of truth used by the match progress page.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { getMatcherState, isMatcherAlive } from "$lib/server/job/matcher-state";
import { getMatchCounts, getEligibleUnmatchedCount } from "$lib/server/job/match-counts";

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const profileId = parseInt(url.searchParams.get("profileId") || "");
  if (isNaN(profileId)) {
    throw error(400, "Missing profileId parameter");
  }

  const includeIneligible = url.searchParams.get("includeIneligible") === "true";

  // Verify profile belongs to user
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true },
  });
  if (!profile) {
    throw error(403, "Profile not found or not owned by user");
  }

  // Load matcher config
  const matchConfig = await db.query.match_config.findFirst({
    where: { profile_id: profileId },
  });

  const matchCommunityJobs = matchConfig?.match_community_jobs ?? false;
  const communityMaxAgeDays = (matchConfig as Record<string, unknown> | null)?.community_max_age_days as number | null ?? null;

  // Run all queries in parallel
  const [counts, eligibleUnmatched, matcherState, matcherAlive, recentMatches] = await Promise
    .all([
      getMatchCounts(profileId, matchCommunityJobs, communityMaxAgeDays),
      getEligibleUnmatchedCount(profileId, matchCommunityJobs, matchConfig ? { ...matchConfig, community_max_age_days: communityMaxAgeDays } : null),
      getMatcherState(profileId),
      isMatcherAlive(),
      db.query.job_matches.findMany({
        where: {
          profile_id: profileId,
          ...(!includeIneligible && { recommendation: { not: "ineligible" } }),
        },
        orderBy: { date_created: "desc" },
        limit: 20,
        select: {
          id: true,
          job_id: true,
          score: true,
          recommendation: true,
          date_created: true,
          skill_match_percentage: true,
          match_summary: true,
          jobs: {
            select: {
              id: true,
              title: true,
              company: true,
              office_location: true,
              job_types: true,
              work_location: true,
            },
          },
        },
      }),
    ]);

  return json({
    ...counts,
    eligibleUnmatched,
    matcherState,
    matcherAlive,
    recentMatches,
  });
};
