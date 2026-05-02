import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  parseIntParam,
  requireAuth,
  requireProfileAccess,
} from "$lib/server/utils/api-helpers";
import { getPreferredDevice } from "$lib/server/tunnel-status";

/**
 * GET /api/tunnel/status/preferred?profileId=123 — the single device that
 * would be used by default when scraping. Prefers the user's own connected
 * devices on the given profile, then falls back to connected devices that
 * have been shared with them. Returns `{ device: null }` when nothing is
 * connected.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  const profileIdStr = url.searchParams.get("profileId");
  if (!profileIdStr) {
    return json({ device: null });
  }
  const profileId = parseIntParam(profileIdStr, "profile");
  await requireProfileAccess(profileId, user.id);

  const device = await getPreferredDevice(user.id, profileId);
  return json({ device });
};
