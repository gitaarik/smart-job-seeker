import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

/**
 * PATCH /api/profile/[id]/ui-preferences
 *
 * Merge key/value pairs into the profile's ui_preferences JSONB column.
 * Body: { [key: string]: any }
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw error(400, "Body must be a JSON object");
  }

  const profile = await db.profiles.findUniqueOrThrow({
    where: { id: profileId },
    select: { ui_preferences: true },
  });

  const existing = (profile.ui_preferences as Record<string, unknown>) ?? {};
  const merged = { ...existing, ...body };

  await db.profiles.update({
    where: { id: profileId },
    data: { ui_preferences: merged },
  });

  return json({ ok: true });
};
