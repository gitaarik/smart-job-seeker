/**
 * Admin Matcher Status API
 *
 * Returns global matcher state plus per-profile match statistics.
 * Uses shared match counting queries from match-counts.ts.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAllMatcherStates, isMatcherAlive } from "$lib/server/job/matcher-state";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getMatchCounts } from "$lib/server/job/match-counts";

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

  // Get per-profile match stats using shared match counting
  const configMap = new Map(configs.map((c) => [c.profile, c]));
  const profileStats = await Promise.all(
    profiles.map(async (p) => {
      const matchCommunityJobs = configMap.get(p.id)?.match_community_jobs ?? false;
      const counts = await getMatchCounts(p.id, matchCommunityJobs);

      return {
        id: p.id,
        name: p.name ?? `Profile ${p.id}`,
        matchCommunityJobs,
        ...counts,
        noMatchCount: counts.notRecommendedCount + counts.ineligibleCount,
      };
    }),
  );

  return json({
    matcherStates: states,
    matcherAlive,
    profiles: profileStats,
  });
};
