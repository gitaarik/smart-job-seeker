import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import { hasDeviceAccess } from "$lib/server/device-shares";
import { db } from "$lib/server/db";
import { api_keys } from "$lib/server/db/schema";
import { fetchUserSjsBrowserStatus } from "$lib/server/sjs-browser-status";

/**
 * GET /api/tunnel/status — status for the logged-in user's connected devices.
 * GET /api/tunnel/status?apiKeyId=N — status for one device (owner or shared).
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
      columns: { user_id: true },
    });
    if (!apiKey) {
      return json({ connected: false, devices: [], status: "not_found" });
    }
    const status = await fetchUserSjsBrowserStatus(apiKey.user_id);
    const devices = status.devices.filter((d) => d.apiKeyId === apiKeyId);
    return json({ connected: devices.length > 0, devices });
  }

  return json(await fetchUserSjsBrowserStatus(user.id));
};
