import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";
import { revokeApiKey, activateApiKey, deleteApiKey, renameApiKey } from "$lib/server/auth/api-key";

/**
 * PATCH /api/api-keys/[id]?profileId=123 — Update an API key (activate or rename)
 */
export const PATCH: RequestHandler = async ({ params, locals, url, request }) => {
  const user = requireAuth(locals);
  const keyId = parseIntParam(params.id, "api-key");
  const profileId = parseIntParam(url.searchParams.get("profileId") ?? "", "profile");
  await requireProfileAccess(profileId, user.id);

  const body = await request.json();

  if (body.action === "activate") {
    const activated = await activateApiKey(keyId, profileId);
    if (!activated) {
      throw error(404, "Device key not found or not revoked");
    }
    return json({ success: true });
  }

  if (body.action === "rename") {
    const name = body.name?.trim();
    if (!name) throw error(400, "Name is required");
    const renamed = await renameApiKey(keyId, profileId, name);
    if (!renamed) {
      throw error(404, "Device key not found");
    }
    return json({ success: true });
  }

  throw error(400, "Invalid action");
};

/**
 * DELETE /api/api-keys/[id]?profileId=123 — Revoke or permanently delete an API key
 */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const keyId = parseIntParam(params.id, "api-key");
  const profileId = parseIntParam(url.searchParams.get("profileId") ?? "", "profile");
  const permanent = url.searchParams.get("permanent") === "true";
  await requireProfileAccess(profileId, user.id);

  if (permanent) {
    const deleted = await deleteApiKey(keyId, profileId);
    if (!deleted) {
      throw error(404, "Device key not found");
    }
    return json({ success: true });
  }

  const revoked = await revokeApiKey(keyId, profileId);
  if (!revoked) {
    throw error(404, "Device key not found");
  }

  return json({ success: true });
};
