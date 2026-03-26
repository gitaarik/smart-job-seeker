/**
 * Shared match counting queries.
 *
 * SINGLE SOURCE OF TRUTH for job match statistics.
 * Used by the matcher status API and the match progress page.
 * Uses the same visibility scope (match_community_jobs) as the matcher itself.
 */

import { Prisma } from "../../../../generated/prisma/client";
import { dbDirect as db } from "$lib/server/db";
import { buildEligibilityFilter } from "$lib/server/job/eligibility";
import { getProfileSkills } from "$lib/server/job/match-utils";

export interface MatchCounts {
  totalJobs: number;
  matchedCount: number;
  notRecommendedCount: number;
  ineligibleCount: number;
  unmatchedCount: number;
}

/**
 * Build FROM + WHERE fragments scoped by match_community_jobs setting.
 * When match_community_jobs is off, only jobs imported by this profile are visible.
 */
export function buildVisibilityScope(profileId: number, matchCommunityJobs: boolean) {
  const ownershipFilter = matchCommunityJobs
    ? Prisma.empty
    : Prisma.sql`AND ji.id IS NOT NULL`;

  return {
    from: Prisma.sql`
      FROM jobs j
      LEFT JOIN job_importers ji ON j.id = ji.job AND ji.profile = ${profileId}`,
    where: Prisma.sql`
      WHERE j.status != 'archived'
      ${ownershipFilter}`,
  };
}

/**
 * Get all match counts in a single query using the shared visibility scope.
 * Returns totals for matched, not recommended, ineligible, and unmatched jobs.
 */
export async function getMatchCounts(
  profileId: number,
  matchCommunityJobs: boolean,
): Promise<MatchCounts> {
  const { from, where } = buildVisibilityScope(profileId, matchCommunityJobs);

  const result = await db.$queryRaw<{
    total: number;
    matched: number;
    not_recommended: number;
    ineligible: number;
    unmatched: number;
  }[]>`
    SELECT
      COUNT(DISTINCT j.id)::int AS total,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation IN ('highly_recommend', 'recommend', 'consider'))::int AS matched,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation = 'not_recommended')::int AS not_recommended,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation = 'ineligible')::int AS ineligible,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.id IS NULL)::int AS unmatched
    ${from}
    LEFT JOIN job_matches jm ON j.id = jm.job AND jm.profile = ${profileId}
    ${where}
  `;

  const row = result[0];
  return {
    totalJobs: row.total,
    matchedCount: row.matched,
    notRecommendedCount: row.not_recommended,
    ineligibleCount: row.ineligible,
    unmatchedCount: row.unmatched,
  };
}

/**
 * Count unmatched jobs that pass the eligibility filter.
 * These are jobs the matcher will send to the LLM for scoring.
 * Returns 0 if match config is incomplete (no work locations, job types, or skills).
 */
export async function getEligibleUnmatchedCount(
  profileId: number,
  matchCommunityJobs: boolean,
  matchConfig: { work_location: unknown; job_types: unknown } | null,
): Promise<number> {
  const workLocations = matchConfig?.work_location as string[] | null;
  const jobTypes = matchConfig?.job_types as string[] | null;
  const profileSkills = await getProfileSkills(profileId);

  if (!workLocations?.length || !jobTypes?.length || profileSkills.length === 0) {
    return 0;
  }

  const { from, where } = buildVisibilityScope(profileId, matchCommunityJobs);
  const eligibilityFilter = buildEligibilityFilter(
    { work_location: workLocations, job_types: jobTypes },
    profileSkills,
  );

  const result = await db.$queryRaw<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt
    ${from}
    LEFT JOIN job_matches jm ON j.id = jm.job AND jm.profile = ${profileId}
    ${where}
    AND jm.id IS NULL
    AND ${eligibilityFilter}
  `;

  return result[0]?.cnt ?? 0;
}
