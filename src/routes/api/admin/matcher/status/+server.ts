import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAllMatcherStates, isMatcherAlive } from "$lib/server/job/matcher-state";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";

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

  return json({
    matcherStates: states,
    matcherAlive,
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name ?? `Profile ${p.id}`,
    })),
  });
};
