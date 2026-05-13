import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, gt, inArray, asc } from "drizzle-orm";
import { search_task_runs, scraper_logs } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

/**
 * GET /api/import-tasks/[id]/runs/[runId]/logs
 *
 * Get logs for a specific run.
 * Supports pagination and filtering by timestamp for live updates.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");
  const runId = parseIntParam(params.runId, "run");

  // Get the run and verify ownership through job search
  const run = await db.query.search_task_runs.findFirst({
    where: and(
      eq(search_task_runs.id, runId),
      eq(search_task_runs.search_task_id, searchTaskId),
    ),
    with: {
      search_task: {
        with: {
          profile: true,
        },
      },
    },
  });

  if (!run) {
    throw error(404, "Run not found");
  }

  if (run.search_task.profile.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  // Parse query params
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const afterTimestamp = url.searchParams.get("after");
  const minLevel = url.searchParams.get("level") || "info"; // debug, info, warn, error

  // Map log level to numeric priority for filtering
  const levelPriority: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  const minPriority = levelPriority[minLevel] ?? 1;
  const includedLevels = Object.entries(levelPriority)
    .filter(([, priority]) => priority >= minPriority)
    .map(([level]) => level);

  // Build where conditions
  const conditions = [
    eq(scraper_logs.run_id, runId),
    inArray(scraper_logs.level, includedLevels),
  ];

  if (afterTimestamp) {
    conditions.push(gt(scraper_logs.timestamp, new Date(afterTimestamp)));
  }

  // Get logs
  const logs = await db.query.scraper_logs.findMany({
    where: and(...conditions),
    orderBy: asc(scraper_logs.timestamp),
    limit: limit,
    columns: {
      id: true,
      level: true,
      message: true,
      timestamp: true,
      screenshot_path: true,
    },
  });

  return json({
    logs,
    runStatus: run.status,
    runStartedAt: run.started_at,
    runFinishedAt: run.finished_at,
    jobsFound: run.jobs_found,
    errorMessage: run.error_message,
    liveUrl: run.live_url,
  });
};
