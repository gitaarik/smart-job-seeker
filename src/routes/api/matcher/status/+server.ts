/**
 * Matcher Status API
 *
 * Returns matcher progress: total jobs, matched count, unmatched count,
 * recently matched jobs, and current matcher state from Redis.
 *
 * The "eligible unmatched" count uses buildEligibilityFilter() — the same
 * single source of truth used by the matcher itself.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { getMatcherState } from "$lib/server/job/matcher-state";
import { getProfileSkills } from "$lib/server/job/match-utils";
import { buildEligibilityFilter } from "$lib/server/job/eligibility";

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const profileId = parseInt(url.searchParams.get("profileId") || "");
  if (isNaN(profileId)) {
    throw error(400, "Missing profileId parameter");
  }

  // Verify profile belongs to user
  const profile = await db.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true },
  });
  if (!profile) {
    throw error(403, "Profile not found or not owned by user");
  }

  // Load matcher config for eligibility counting
  const matchConfig = await db.job_match_config.findFirst({
    where: { profile: profileId },
  });

  // Get profile skills for eligibility counting
  const profileSkills = await getProfileSkills(profileId);

  // Get counts in parallel
  const [totalJobs, matchedCount, matcherState, recentMatches] = await Promise
    .all([
      // Total non-archived jobs
      db.jobs.count({
        where: { status: { not: "archived" } },
      }),

      // Jobs with a match record for this profile
      db.job_matches.count({
        where: { profile: profileId },
      }),

      // Current matcher state from Redis
      getMatcherState(),

      // Recently matched jobs (last 20, excluding ineligible)
      db.job_matches.findMany({
        where: { profile: profileId, recommendation: { not: "ineligible" } },
        orderBy: { date_created: "desc" },
        take: 20,
        select: {
          id: true,
          job: true,
          score: true,
          recommendation: true,
          status: true,
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

  const unmatchedCount = totalJobs - matchedCount;

  // Count eligible unmatched jobs using the shared eligibility filter
  let eligibleUnmatched = 0;
  const workLocations = matchConfig?.work_location as string[] | null;
  const jobTypes = matchConfig?.job_types as string[] | null;

  if (workLocations?.length && jobTypes?.length && profileSkills.length > 0) {
    const eligibilityFilter = buildEligibilityFilter(
      { work_location: workLocations, job_types: jobTypes },
      profileSkills,
    );

    const result = await db.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(*)::int as cnt FROM jobs j
      LEFT JOIN job_matches jm ON j.id = jm.job AND jm.profile = ${profileId}
      WHERE jm.id IS NULL
      AND j.status != 'archived'
      AND ${eligibilityFilter}
    `;
    eligibleUnmatched = result[0]?.cnt ?? 0;
  }

  return json({
    totalJobs,
    matchedCount,
    unmatchedCount,
    eligibleUnmatched,
    matcherState,
    recentMatches,
  });
};
