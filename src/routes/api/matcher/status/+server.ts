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
import { Prisma } from "../../../../../generated/prisma/client";
import { dbDirect as db } from "$lib/server/db";
import { getMatcherState, isMatcherAlive } from "$lib/server/job/matcher-state";
import { getProfileSkills } from "$lib/server/job/match-utils";
import { buildEligibilityFilter } from "$lib/server/job/eligibility";

/**
 * Shared visibility scope for all job queries in this endpoint.
 *
 * SINGLE SOURCE OF TRUTH: every query uses these same fragments so
 * that totalJobs, matchedCount, noMatchCount, and eligibleUnmatched
 * are always consistent with each other.
 *
 * When match_community_jobs is off, only jobs imported by this profile
 * (via job_importers) are visible.
 */
function buildVisibilityScope(profileId: number, matchCommunityJobs: boolean) {
  const ownershipFilter = matchCommunityJobs
    ? Prisma.empty
    : Prisma.sql`AND ji.id IS NOT NULL`;

  return {
    /** FROM + JOIN fragment — append additional JOINs after this */
    from: Prisma.sql`
      FROM jobs j
      LEFT JOIN job_importers ji ON j.id = ji.job AND ji.profile = ${profileId}`,
    /** WHERE conditions — combine with AND for additional filters */
    where: Prisma.sql`
      WHERE j.status != 'archived'
      ${ownershipFilter}`,
  };
}

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
  const profile = await db.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true },
  });
  if (!profile) {
    throw error(403, "Profile not found or not owned by user");
  }

  // Load matcher config for eligibility counting
  const matchConfig = await db.match_config.findFirst({
    where: { profile: profileId },
  });

  const profileSkills = await getProfileSkills(profileId);
  const matchCommunityJobs = matchConfig?.match_community_jobs ?? false;
  const { from, where } = buildVisibilityScope(profileId, matchCommunityJobs);

  // Single query for all counts — uses the shared visibility scope
  // so total, matched, and no_match are always consistent
  const countsQuery = db.$queryRaw<{
    total: number;
    matched: number;
    no_match: number;
  }[]>`
    SELECT
      COUNT(DISTINCT j.id)::int AS total,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation IN ('highly_recommend', 'recommend', 'consider'))::int AS matched,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation IN ('not_recommended', 'ineligible'))::int AS no_match
    ${from}
    LEFT JOIN job_matches jm ON j.id = jm.job AND jm.profile = ${profileId}
    ${where}
  `;

  // Eligible unmatched: jobs that pass the eligibility filter but haven't been evaluated
  let eligibleUnmatchedQuery: Promise<{ cnt: number }[]> | null = null;
  const workLocations = matchConfig?.work_location as string[] | null;
  const jobTypes = matchConfig?.job_types as string[] | null;

  if (workLocations?.length && jobTypes?.length && profileSkills.length > 0) {
    const eligibilityFilter = buildEligibilityFilter(
      { work_location: workLocations, job_types: jobTypes },
      profileSkills,
    );

    eligibleUnmatchedQuery = db.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(*)::int as cnt
      ${from}
      LEFT JOIN job_matches jm ON j.id = jm.job AND jm.profile = ${profileId}
      ${where}
      AND jm.id IS NULL
      AND ${eligibilityFilter}
    `;
  }

  // Run all queries in parallel
  const [counts, eligibleResult, matcherState, matcherAlive, recentMatches] = await Promise
    .all([
      countsQuery,
      eligibleUnmatchedQuery ?? Promise.resolve([{ cnt: 0 }]),
      getMatcherState(profileId),
      isMatcherAlive(),
      db.job_matches.findMany({
        where: {
          profile: profileId,
          ...(!includeIneligible && { recommendation: { not: "ineligible" } }),
        },
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

  const { total: totalJobs, matched: matchedCount, no_match: noMatchCount } = counts[0];
  const evaluatedCount = matchedCount + noMatchCount;
  const unmatchedCount = totalJobs - evaluatedCount;
  const eligibleUnmatched = eligibleResult[0]?.cnt ?? 0;

  return json({
    totalJobs,
    matchedCount,
    noMatchCount,
    unmatchedCount,
    eligibleUnmatched,
    matcherState,
    matcherAlive,
    recentMatches,
  });
};
