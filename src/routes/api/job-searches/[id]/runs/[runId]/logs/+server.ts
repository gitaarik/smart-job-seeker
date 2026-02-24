import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * GET /api/job-searches/[id]/runs/[runId]/logs
 *
 * Get logs for a specific run.
 * Supports pagination and filtering by timestamp for live updates.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const jobSearchId = parseInt(params.id);
  const runId = parseInt(params.runId);

  if (isNaN(jobSearchId) || isNaN(runId)) {
    throw error(400, "Invalid job search ID or run ID");
  }

  // Get the run and verify ownership through job search
  const run = await db.job_search_runs.findFirst({
    where: {
      id: runId,
      job_search_id: jobSearchId,
    },
    include: {
      job_searches: {
        include: {
          profiles: true,
        },
      },
    },
  });

  if (!run) {
    throw error(404, "Run not found");
  }

  if (run.job_searches.profiles.user_id !== user.id) {
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

  // Build where clause
  const where: { run_id: number; timestamp?: { gt: Date }; level?: { in: string[] } } = {
    run_id: runId,
    level: { in: includedLevels },
  };

  if (afterTimestamp) {
    where.timestamp = { gt: new Date(afterTimestamp) };
  }

  // Get logs
  const logs = await db.scraper_logs.findMany({
    where,
    orderBy: { timestamp: "asc" },
    take: limit,
    select: {
      id: true,
      level: true,
      message: true,
      timestamp: true,
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
