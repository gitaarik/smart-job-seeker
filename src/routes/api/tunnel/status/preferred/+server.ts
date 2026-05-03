import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  parseIntParam,
  requireAuth,
  requireProfileAccess,
} from "$lib/server/utils/api-helpers";
import {
  getDeviceById,
  getPreferredDevice,
} from "$lib/server/tunnel-status";

/**
 * GET /api/tunnel/status/preferred?profileId=123[&apiKeyId=456] — the
 * device that would be used when scraping.
 *
 *   - Without `apiKeyId`: the user's auto-pick — own connected devices on
 *     the profile first, then shared connected devices.
 *   - With `apiKeyId`: that specific device's status, so the search-task
 *     UI can display the device the task is actually configured to use
 *     (`search_tasks.tunnel_api_key`) instead of the auto-pick.
 *
 * Returns `{ device: null }` when nothing matches/is connected.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  const profileIdStr = url.searchParams.get("profileId");
  if (!profileIdStr) {
    return json({ device: null });
  }
  const profileId = parseIntParam(profileIdStr, "profile");
  await requireProfileAccess(profileId, user.id);

  const apiKeyIdStr = url.searchParams.get("apiKeyId");
  const device = apiKeyIdStr
    ? await getDeviceById(
      user.id,
      profileId,
      parseIntParam(apiKeyIdStr, "apiKey"),
    )
    : await getPreferredDevice(user.id, profileId);
  return json({ device });
};
