/**
 * Admin Matcher Status API
 *
 * Returns global matcher state plus per-profile match statistics.
 * Uses the same buildVisibilityScope pattern as the user-facing
 * status API so counts are always consistent.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { Prisma } from "../../../../../../generated/prisma/client";
import { getAllMatcherStates, isMatcherAlive } from "$lib/server/job/matcher-state";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";

function buildVisibilityScope(profileId: number, matchCommunityJobs: boolean) {
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

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const [states, configs, matcherAlive] = await Promise.all([
    getAllMatcherStates(),
    db.match_config.findMany({
      select: {
        profile: true,
        match_community_jobs: true,
      },
    }),
    isMatcherAlive(),
  ]);

  // Get profile names for all profiles with match_config
  const profileIds = configs.map((c) => c.profile);
  const profiles = await db.profiles.findMany({
    where: { id: { in: profileIds } },
    select: { id: true, name: true },
  });

  // Get per-profile match stats using the shared visibility scope
  const configMap = new Map(configs.map((c) => [c.profile, c]));
  const profileStats = await Promise.all(
    profiles.map(async (p) => {
      const matchCommunityJobs = configMap.get(p.id)?.match_community_jobs ?? false;
      const { from, where } = buildVisibilityScope(p.id, matchCommunityJobs);

      const counts = await db.$queryRaw<{
        total: number;
        matched: number;
        no_match: number;
      }[]>`
        SELECT
          COUNT(DISTINCT j.id)::int AS total,
          COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation IN ('highly_recommend', 'recommend', 'consider'))::int AS matched,
          COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation IN ('not_recommended', 'ineligible'))::int AS no_match
        ${from}
        LEFT JOIN job_matches jm ON j.id = jm.job AND jm.profile = ${p.id}
        ${where}
      `;

      const { total, matched, no_match } = counts[0];
      const evaluated = matched + no_match;

      return {
        id: p.id,
        name: p.name ?? `Profile ${p.id}`,
        matchCommunityJobs,
        totalJobs: total,
        matchedCount: matched,
        noMatchCount: no_match,
        unmatchedCount: total - evaluated,
      };
    }),
  );

  return json({
    matcherStates: states,
    matcherAlive,
    profiles: profileStats,
  });
};
