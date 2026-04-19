import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { search_tasks } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

/**
 * PATCH /api/import-tasks/[id]/ui-preferences
 *
 * Merge key/value pairs into the job search's ui_preferences JSONB column.
 * Body: { [key: string]: any }
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    with: { profile: { columns: { user_id: true } } },
  });

  if (!searchTask || searchTask.profile.user_id !== user.id) {
    throw error(403, "Access denied");
  }

  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw error(400, "Body must be a JSON object");
  }

  const existing = (searchTask.ui_preferences as Record<string, unknown>) ?? {};
  const merged = { ...existing, ...body };

  await db.update(search_tasks).set({ ui_preferences: merged })
    .where(eq(search_tasks.id, searchTaskId));

  return json({ ok: true });
};
