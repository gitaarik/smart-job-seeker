import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";
import { revokeApiKey } from "$lib/server/auth/api-key";

/**
 * DELETE /api/api-keys/[id]?profileId=123 — Revoke an API key
 */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const keyId = parseIntParam(params.id, "api-key");
  const profileId = parseIntParam(url.searchParams.get("profileId") ?? "", "profile");
  await requireProfileAccess(profileId, user.id);

  const revoked = await revokeApiKey(keyId, profileId);
  if (!revoked) {
    throw error(404, "API key not found");
  }

  return json({ success: true });
};
