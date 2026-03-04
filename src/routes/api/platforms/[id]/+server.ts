import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { platformUpdateSchema, parseBody } from "$lib/server/validation/api-schemas";

/**
 * PATCH /api/platforms/[id]
 *
 * Update platform fields (e.g. login_page_url).
 * Staff can always edit. Normal users can only edit if no other user's
 * accounts reference this platform.
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const platformId = parseIntParam(params.id, "platform");

  const platform = await db.job_platforms.findFirst({
    where: { id: platformId },
  });
  if (!platform) {
    throw error(404, "Platform not found");
  }

  // Authorization: staff can always edit
  const isStaff =
    (user as { is_staff?: boolean }).is_staff ||
    (user as { is_admin?: boolean }).is_admin ||
    false;

  if (!isStaff) {
    // Normal user: check that no other user uses this platform
    const otherUserUsage = await db.job_searches.findFirst({
      where: {
        platform: platformId,
        profiles: { user_id: { not: user.id } },
      },
      select: { id: true },
    });
    if (otherUserUsage) {
      throw error(403, "Cannot edit platform URLs used by other accounts");
    }

    // Also verify the current user actually uses this platform
    const ownUsage = await db.job_searches.findFirst({
      where: {
        platform: platformId,
        profiles: { user_id: user.id },
      },
      select: { id: true },
    });
    if (!ownUsage) {
      throw error(403, "Not authorized");
    }
  }

  const data = parseBody(platformUpdateSchema, await request.json());

  await db.job_platforms.update({
    where: { id: platformId },
    data: { ...data, date_updated: new Date() },
  });

  return json({ ok: true });
};
