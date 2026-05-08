import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import {
  parseIntParam,
  requireAuth,
  requireProfileAccess,
} from "$lib/server/utils/api-helpers";
import { hasDeviceAccess } from "$lib/server/device-shares";
import { db } from "$lib/server/db";
import { api_keys } from "$lib/server/db/schema";
import { fetchProfileSjsBrowserStatus } from "$lib/server/sjs-browser-status";

/**
 * GET /api/tunnel/status?profileId=123 — status for all devices on a profile (owner only).
 * GET /api/tunnel/status?apiKeyId=456 — status for one device (owner OR contact it's shared with).
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  const apiKeyIdStr = url.searchParams.get("apiKeyId");
  if (apiKeyIdStr) {
    const apiKeyId = parseIntParam(apiKeyIdStr, "apiKey");
    if (!(await hasDeviceAccess(apiKeyId, user.id))) {
      return json({ connected: false, devices: [], status: "unauthorized" }, {
        status: 403,
      });
    }
    const apiKey = await db.query.api_keys.findFirst({
      where: eq(api_keys.id, apiKeyId),
      columns: { profile_id: true },
    });
    if (!apiKey) {
      return json({ connected: false, devices: [], status: "not_found" });
    }
    const status = await fetchProfileSjsBrowserStatus(apiKey.profile_id);
    const devices = status.devices.filter((d) => d.apiKeyId === apiKeyId);
    return json({ connected: devices.length > 0, devices });
  }

  const profileIdStr = url.searchParams.get("profileId");
  if (!profileIdStr) {
    return json({ connected: false, status: "no_profile" });
  }
  const profileId = parseIntParam(profileIdStr, "profile");
  await requireProfileAccess(profileId, user.id);
  return json(await fetchProfileSjsBrowserStatus(profileId));
};
