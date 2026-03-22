/**
 * Rematch API
 *
 * Deletes ineligible and/or not_recommended match records for a profile,
 * so the matcher re-evaluates them in the next cycle.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const body = await request.json();
  const profileId = parseInt(body.profileId);
  if (isNaN(profileId)) {
    throw error(400, "Missing profileId");
  }

  // Verify profile belongs to user
  const profile = await db.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true },
  });
  if (!profile) {
    throw error(403, "Profile not found or not owned by user");
  }

  // Delete ineligible and not_recommended matches so they get re-evaluated
  const deleted = await db.job_matches.deleteMany({
    where: {
      profile: profileId,
      recommendation: { in: ["ineligible", "not_recommended"] },
    },
  });

  return json({ deleted: deleted.count });
};
