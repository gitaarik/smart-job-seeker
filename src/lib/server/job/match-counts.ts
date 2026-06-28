/**
 * Shared match counting queries.
 *
 * SINGLE SOURCE OF TRUTH for job match statistics.
 * Used by the matcher status API and the match progress page.
 * Uses the same visibility scope (match_community_jobs) as the matcher itself.
 */

import type { SQL } from "drizzle-orm";
import { dbDirect as db, queryRaw, sql, sqlJoin } from "$lib/server/db";
import { buildEligibilityFilter } from "$lib/server/job/eligibility";
import { getExpandedProfileSkills } from "$lib/server/job/match-utils";

export interface MatchCounts {
  totalJobs: number;
  matchedCount: number;       // score > 0 (LLM evaluated, any positive score)
  noMatchCount: number;       // score = 0 with a job_matches row (not recommended + ineligible)
  notRecommendedCount: number; // subset of noMatch: LLM said not recommended
  ineligibleCount: number;     // subset of noMatch: failed eligibility filter
  unmatchedCount: number;      // no job_matches row yet
}

/**
 * Build FROM + WHERE fragments scoped by match_community_jobs setting.
 * When match_community_jobs is off, only jobs imported by this profile are visible.
 * When community_max_age_days is set, community jobs older than that are excluded
 * (own-imported jobs are always included regardless of age).
 */
export function buildVisibilityScope(
  profileId: number,
  matchCommunityJobs: boolean,
  communityMaxAgeDays?: number | null,
) {
  const ownershipFilter = matchCommunityJobs
    ? sql``
    : sql`AND ji.id IS NOT NULL`;

  // When community matching is on with an age limit, with:
  // - all own-imported jobs (ji.id IS NOT NULL), regardless of age
  // - community jobs only if created within the age window
  const ageFilter = matchCommunityJobs && communityMaxAgeDays
    ? sql`AND (ji.id IS NOT NULL OR j.date_created >= NOW() - MAKE_INTERVAL(days => ${communityMaxAgeDays}))`
    : sql``;

  return {
    from: sql`
      FROM jobs j
      LEFT JOIN job_importers ji ON j.id = ji.job_id AND ji.profile_id = ${profileId}`,
    where: sql`
      WHERE j.status != 'archived'
      ${ownershipFilter}
      ${ageFilter}`,
  };
}

/**
 * Get all match counts in a single query using the shared visibility scope.
 * Returns totals for matched, not recommended, ineligible, and unmatched jobs.
 */
export async function getMatchCounts(
  profileId: number,
  matchCommunityJobs: boolean,
  communityMaxAgeDays?: number | null,
): Promise<MatchCounts> {
  const { from, where } = buildVisibilityScope(profileId, matchCommunityJobs, communityMaxAgeDays);

  const result = await queryRaw<{
    total: number;
    matched: number;
    no_match: number;
    not_recommended: number;
    ineligible: number;
    unmatched: number;
  }>(sql`
    SELECT
      COUNT(DISTINCT j.id)::int AS total,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.score > 0)::int AS matched,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.id IS NOT NULL AND jm.score = 0)::int AS no_match,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation = 'not_recommended')::int AS not_recommended,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation = 'ineligible')::int AS ineligible,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.id IS NULL)::int AS unmatched
    ${from}
    LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.profile_id = ${profileId}
    ${where}
  `);

  const row = result[0];
  return {
    totalJobs: row.total,
    matchedCount: row.matched,
    noMatchCount: row.no_match,
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
  matchConfig: { work_location: unknown; job_types: unknown; experience_levels?: unknown; community_max_age_days?: number | null } | null,
): Promise<number> {
  const workLocations = matchConfig?.work_location as string[] | null;
  const jobTypes = matchConfig?.job_types as string[] | null;
  const experienceLevels = matchConfig?.experience_levels as string[] | null;
  const profileSkills = await getExpandedProfileSkills(profileId);

  if (!workLocations?.length || !jobTypes?.length || profileSkills.length === 0) {
    return 0;
  }

  const { from, where } = buildVisibilityScope(profileId, matchCommunityJobs, matchConfig?.community_max_age_days);
  const eligibilityFilter = buildEligibilityFilter(
    { work_location: workLocations, job_types: jobTypes, experience_levels: experienceLevels },
    profileSkills,
  );

  const result = await queryRaw<{ cnt: number }>(sql`
    SELECT COUNT(*)::int as cnt
    ${from}
    LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.profile_id = ${profileId}
    ${where}
    AND jm.id IS NULL
    AND ${eligibilityFilter}
  `);

  return result[0]?.cnt ?? 0;
}

/**
 * Count unmatched community jobs for multiple time windows at once.
 * Returns a map of { days: count } for the given windows, plus null for "all time".
 * Only counts community jobs (excludes own-imported jobs from the count).
 */
export async function getCommunityJobCountsByWindow(
  profileId: number,
  windows: (number | null)[],
): Promise<Map<number | null, number>> {
  const result = await queryRaw<{ days: number | null; cnt: number }>(sql`
    SELECT
      w.days,
      COUNT(DISTINCT j.id)::int AS cnt
    FROM UNNEST(ARRAY[${sqlJoin(windows.map((w) => w ?? -1))}]::int[]) AS w(days)
    LEFT JOIN jobs j ON j.status != 'archived'
      AND j.id NOT IN (SELECT ji.job_id FROM job_importers ji WHERE ji.profile_id = ${profileId})
      AND (w.days = -1 OR j.date_created >= NOW() - MAKE_INTERVAL(days => w.days))
    LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.profile_id = ${profileId}
    WHERE jm.id IS NULL
    GROUP BY w.days
    ORDER BY w.days
  `);

  const map = new Map<number | null, number>();
  for (const row of result) {
    const key = row.days === -1 ? null : row.days;
    map.set(key, row.cnt);
  }
  return map;
}
