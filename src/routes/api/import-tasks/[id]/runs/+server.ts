import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

/**
 * GET /api/import-tasks/[id]/runs
 *
 * List all runs for a job search, ordered by most recent first.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  // Get the job search and verify ownership
  const searchTask = await db.search_tasks.findFirst({
    where: { id: searchTaskId },
    include: {
      profiles: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  if (searchTask.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  // Parse pagination params
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Get runs
  const [runs, total] = await Promise.all([
    db.search_task_runs.findMany({
      where: { search_task_id: searchTaskId },
      orderBy: { started_at: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        status: true,
        started_at: true,
        finished_at: true,
        jobs_found: true,
        error_message: true,
        triggered_by: true,
        live_url: true,
        user_response: true,
        settings: true,
      },
    }),
    db.search_task_runs.count({
      where: { search_task_id: searchTaskId },
    }),
  ]);

  return json({
    runs,
    total,
    limit,
    offset,
  });
};
