import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";
import { createApiKey, listApiKeys } from "$lib/server/auth/api-key";

/**
 * GET /api/api-keys?profileId=123 — List API keys for a profile
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(url.searchParams.get("profileId") ?? "", "profile");
  await requireProfileAccess(profileId, user.id);

  const keys = await listApiKeys(profileId);
  return json({ keys });
};

/**
 * POST /api/api-keys — Create a new API key
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const body = await request.json();
  const profileId = body.profileId;
  if (!profileId || typeof profileId !== "number") {
    throw error(400, "profileId is required");
  }
  await requireProfileAccess(profileId, user.id);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return json({ error: "Name is required" }, { status: 400 });
  }

  const result = await createApiKey(profileId, name);

  return json({
    id: result.id,
    key: result.key,
  });
};
