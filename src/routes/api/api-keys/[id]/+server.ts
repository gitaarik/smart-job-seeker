import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { revokeApiKey } from "$lib/server/auth/api-key";

/**
 * DELETE /api/api-keys/[id] — Revoke an API key
 */
export const DELETE: RequestHandler = async ({ params, locals, cookies }) => {
  requireAuth(locals);
  const keyId = parseIntParam(params.id, "api-key");

  const profileIdStr = cookies.get("selected_profile_id");
  if (!profileIdStr) {
    throw error(400, "No profile selected");
  }
  const profileId = parseInt(profileIdStr, 10);

  const revoked = await revokeApiKey(keyId, profileId);
  if (!revoked) {
    throw error(404, "API key not found");
  }

  return json({ success: true });
};
