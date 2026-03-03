import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * PUT /api/profile/[id]/browser-info
 *
 * Auto-capture or manually update browser fingerprint fields.
 * Only writes fields that are currently empty (won't overwrite manual overrides)
 * unless force=true is passed.
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const profileId = parseInt(params.id, 10);
  if (isNaN(profileId)) {
    throw error(400, "Invalid profile ID");
  }

  const profile = await db.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: {
      id: true,
      browser_user_agent: true,
      browser_language: true,
      browser_timezone: true,
    },
  });

  if (!profile) {
    throw error(403, "Access denied");
  }

  const body = await request.json();
  const force = body.force === true;

  const updateData: Record<string, string> = {};

  if (body.browser_user_agent && (force || !profile.browser_user_agent)) {
    updateData.browser_user_agent = String(body.browser_user_agent).substring(0, 500);
  }
  if (body.browser_language && (force || !profile.browser_language)) {
    updateData.browser_language = String(body.browser_language).substring(0, 50);
  }
  if (body.browser_timezone && (force || !profile.browser_timezone)) {
    updateData.browser_timezone = String(body.browser_timezone).substring(0, 100);
  }

  if (Object.keys(updateData).length > 0) {
    await db.profiles.update({
      where: { id: profileId },
      data: { ...updateData, date_updated: new Date() },
    });
  }

  return json({ success: true, updated: Object.keys(updateData) });
};
