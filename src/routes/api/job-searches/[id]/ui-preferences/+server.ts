import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

/**
 * PATCH /api/job-searches/[id]/ui-preferences
 *
 * Merge key/value pairs into the job search's ui_preferences JSONB column.
 * Body: { [key: string]: any }
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const jobSearchId = parseIntParam(params.id, "job search");

  const jobSearch = await db.job_searches.findFirst({
    where: { id: jobSearchId },
    include: { profiles: { select: { user_id: true } } },
  });

  if (!jobSearch || jobSearch.profiles.user_id !== user.id) {
    throw error(403, "Access denied");
  }

  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw error(400, "Body must be a JSON object");
  }

  const existing = (jobSearch.ui_preferences as Record<string, unknown>) ?? {};
  const merged = { ...existing, ...body };

  await db.job_searches.update({
    where: { id: jobSearchId },
    data: { ui_preferences: merged },
  });

  return json({ ok: true });
};
