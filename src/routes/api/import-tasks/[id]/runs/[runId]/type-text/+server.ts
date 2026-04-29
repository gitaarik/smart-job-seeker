import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { search_task_runs, search_tasks } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import { submitPendingAction } from "$lib/server/scraper/pending-action";

/**
 * POST /api/import-tasks/[id]/runs/[runId]/type-text
 *
 * Type text into the live browser's currently focused input field. Works
 * for both hosted (GoLogin) and tunnel (local Chrome) modes by routing
 * through the scraper itself: writes a pending action to the DB, the
 * scraper picks it up during its intervention wait, executes against the
 * live page, and writes the result back.
 *
 * Body: { text?: string, submit?: boolean, clear?: boolean }
 *
 * - text: The text to type (e.g., "123456")
 * - submit: If true, click submit button or press Enter (default: false)
 * - clear: If true, select all and delete text in focused input (default: false)
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");
  const runId = parseIntParam(params.runId, "run");

  let body: { text?: string; submit?: boolean; clear?: boolean };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  const { text = "", submit = false, clear = false } = body;
  if (!text && !submit && !clear) {
    throw error(400, "Must provide text, submit, or clear");
  }

  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    columns: { profile_id: true },
    with: { profile: { columns: { user_id: true } } },
  });

  if (!searchTask) throw error(404, "Job search not found");
  if (searchTask.profile.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  const run = await db.query.search_task_runs.findFirst({
    where: and(
      eq(search_task_runs.id, runId),
      eq(search_task_runs.search_task_id, searchTaskId),
    ),
    columns: { status: true },
  });

  if (!run) throw error(404, "Run not found");
  if (!["running", "blocked"].includes(run.status)) {
    throw error(400, `Run is not active (status: ${run.status})`);
  }

  const result = clear
    ? await submitPendingAction(runId, { type: "clear" })
    : text
    ? await submitPendingAction(runId, { type: "type_text", text, submit })
    : await submitPendingAction(runId, { type: "submit" });

  return json(result);
};
