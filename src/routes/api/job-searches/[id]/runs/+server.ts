import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

/**
 * GET /api/job-searches/[id]/runs
 *
 * List all runs for a job search, ordered by most recent first.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const jobSearchId = parseIntParam(params.id, "job search");

  // Get the job search and verify ownership
  const jobSearch = await db.job_searches.findFirst({
    where: { id: jobSearchId },
    include: {
      profiles: true,
    },
  });

  if (!jobSearch) {
    throw error(404, "Job search not found");
  }

  if (jobSearch.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  // Parse pagination params
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Get runs
  const [runs, total] = await Promise.all([
    db.job_search_runs.findMany({
      where: { job_search_id: jobSearchId },
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
      },
    }),
    db.job_search_runs.count({
      where: { job_search_id: jobSearchId },
    }),
  ]);

  return json({
    runs,
    total,
    limit,
    offset,
  });
};
