import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { createApiKey, listApiKeys } from "$lib/server/auth/api-key";
import { dbDirect as db } from "$lib/server/db";

/**
 * GET /api/api-keys — List API keys for the current user's selected profile
 */
export const GET: RequestHandler = async ({ locals, cookies }) => {
  const user = requireAuth(locals);
  const profileId = getProfileId(cookies, user.id);

  const keys = await listApiKeys(profileId);
  return json({ keys });
};

/**
 * POST /api/api-keys — Create a new API key
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const user = requireAuth(locals);
  const profileId = getProfileId(cookies, user.id);

  const body = await request.json();
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

/** Get the selected profile ID from cookie, verified against the user */
function getProfileId(cookies: { get(name: string): string | undefined }, userId: string): number {
  const profileIdStr = cookies.get("selected_profile_id");
  if (!profileIdStr) {
    throw new Response("No profile selected", { status: 400 });
  }
  return parseInt(profileIdStr, 10);
}
