/**
 * Community Job Counts API
 *
 * Returns unmatched community job counts for multiple time windows.
 * Used by the config page to show how many jobs each lookback option covers.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { getCommunityJobCountsByWindow } from "$lib/server/job/match-counts";

const WINDOWS = [7, 30, 90, null]; // null = all time

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
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true },
  });
  if (!profile) {
    throw error(403, "Profile not found or not owned by user");
  }

  const counts = await getCommunityJobCountsByWindow(profileId, WINDOWS);

  // Convert Map to plain object for JSON
  const result: Record<string, number> = {};
  for (const [days, count] of counts) {
    result[days === null ? "all" : String(days)] = count;
  }

  return json(result);
};
