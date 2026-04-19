/**
 * Admin Scraper Runs API
 *
 * GET  - Returns recent search task runs across all users
 * POST - Stop or restart a specific run
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db, queryRaw, sql } from "$lib/server/db";
import { eq, and, inArray, lt, desc, count } from "drizzle-orm";
import { search_task_runs, search_task_run_items, search_tasks, users, jobs } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { searchTaskDisplayName } from "$lib/format";
import {
  addScrapeJob,
  removeActiveJob,
  removeWaitingJob,
  getQueueStats,
} from "$lib/server/queue";

export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const statusFilter = url.searchParams.get("status"); // "active", "failed", or null for all

  const statusWhere =
    statusFilter === "active"
      ? inArray(search_task_runs.status, ["running", "queued", "blocked", "stopping"])
      : statusFilter === "failed"
        ? inArray(search_task_runs.status, ["failed", "cancelled"])
        : undefined;

  // Health checks: detect common issues
  const healthChecks = await getHealthChecks();

  const [runs, totalCount, queueStats] = await Promise.all([
    db.query.search_task_runs.findMany({
      where: statusWhere,
      orderBy: desc(search_task_runs.started_at),
      limit: limit,
      offset: offset,
      with: {
        search_task: {
          with: {
            profile: {
              columns: {
                id: true,
                name: true,
                user_id: true,
              },
            },
            job_platform: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    db.select({ value: count() }).from(search_task_runs).where(statusWhere).then(([r]) => r.value),
    getQueueStats(),
  ]);

  // Collect unique user_ids and fetch users separately (no FK relation in schema)
  const userIds = [...new Set(
    runs.map((r) => r.search_task.profile.user_id).filter(Boolean) as string[],
  )];
  const userList = userIds.length > 0
    ? await db.query.users.findMany({
        where: inArray(users.id, userIds),
        columns: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(userList.map((u) => [u.id, u]));

  return json({
    runs: runs.map((r) => {
      const u = userMap.get(r.search_task.profile.user_id ?? "");
      return {
        id: r.id,
        status: r.status,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        jobsFound: r.jobs_found,
        errorMessage: r.error_message,
        triggeredBy: r.triggered_by,
        liveUrl: r.live_url,
        searchTask: {
          id: r.search_task.id,
          name: searchTaskDisplayName(r.search_task.job_platform?.name, r.search_task.note),
          status: r.search_task.status,
          browserProvider: r.search_task.browser_provider,
          searchUrl: r.search_task.search_url,
          platform: r.search_task.job_platform?.name ?? null,
        },
        profile: {
          id: r.search_task.profile.id,
          name: r.search_task.profile.name,
        },
        user: u
          ? { id: u.id, name: u.name, email: u.email }
          : { id: null, name: null, email: "Unknown" },
      };
    }),
    totalCount,
    queueStats,
    healthChecks,
  });
};

// ============================================================================
// Health Checks
// ============================================================================

interface HealthIssue {
  severity: "warning" | "error";
  label: string;
  count: number;
  details?: string;
  fixAction?: string;
}

async function getHealthChecks(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const [
    orphanedItems,
    stuckRunsResult,
    statusMismatches,
  ] = await Promise.all([
    // Completed runs that still have pending/processing items
    queryRaw<{ count: bigint }[]>(sql`
      SELECT COUNT(DISTINCT ri.run_id) as count
      FROM search_task_run_items ri
      JOIN search_task_runs r ON r.id = ri.run_id
      WHERE ri.status IN ('pending', 'processing')
        AND r.status IN ('success', 'error', 'cancelled', 'partial')
    `),
    // Runs stuck in running/queued/stopping for more than 30 minutes
    db.select({ value: count() }).from(search_task_runs).where(
      and(
        inArray(search_task_runs.status, ["running", "queued", "stopping"]),
        lt(search_task_runs.started_at, new Date(Date.now() - 30 * 60 * 1000)),
      ),
    ),
    // Search tasks where status says running/queued but latest run is finished
    queryRaw<{ count: bigint }[]>(sql`
      SELECT COUNT(*) as count
      FROM search_tasks st
      WHERE st.status IN ('running', 'queued', 'blocked', 'stopping')
        AND NOT EXISTS (
          SELECT 1 FROM search_task_runs r
          WHERE r.search_task_id = st.id
            AND r.status IN ('running', 'queued', 'stopping')
        )
    `),
  ]);

  const orphanedCount = Number(orphanedItems[0]?.count ?? 0);
  if (orphanedCount > 0) {
    issues.push({
      severity: "warning",
      label: "Runs with orphaned pending items",
      count: orphanedCount,
      details: "Completed runs still have pending/processing items that were never resolved",
      fixAction: "fix-orphaned-items",
    });
  }

  const stuckRuns = stuckRunsResult[0]?.value ?? 0;
  if (stuckRuns > 0) {
    issues.push({
      severity: "error",
      label: "Stuck runs (>30min in running/queued)",
      count: stuckRuns,
      fixAction: "fix-stuck-runs",
    });
  }

  const mismatchCount = Number(statusMismatches[0]?.count ?? 0);
  if (mismatchCount > 0) {
    issues.push({
      severity: "error",
      label: "Search tasks stuck in running (no active run)",
      count: mismatchCount,
      details: "Task status says running but no active run exists in the database",
      fixAction: "fix-status-mismatches",
    });
  }

  return issues;
}

/**
 * POST /api/admin/scraper
 *
 * Actions: stop, restart
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const body = await request.json();
  const { action, searchTaskId } = body as {
    action: "stop" | "restart" | "fix-orphaned-items" | "fix-stuck-runs" | "fix-status-mismatches";
    searchTaskId?: number;
  };

  if (!action) {
    throw error(400, "Missing action");
  }

  // --- Health fix actions ---

  if (action === "fix-orphaned-items") {
    // Get run IDs with orphaned items via raw SQL since this involves a join condition
    const orphanedRunIds = await queryRaw<{ run_id: number }[]>(sql`
      SELECT DISTINCT ri.run_id
      FROM search_task_run_items ri
      JOIN search_task_runs r ON r.id = ri.run_id
      WHERE ri.status IN ('pending', 'processing')
        AND r.status IN ('success', 'error', 'cancelled', 'partial')
    `);
    const runIds = orphanedRunIds.map((r) => r.run_id);
    if (runIds.length > 0) {
      await db.update(search_task_run_items).set({
        status: "skipped",
        status_message: "Cleaned up by admin",
        processed_at: new Date(),
      }).where(and(
        inArray(search_task_run_items.status, ["pending", "processing"]),
        inArray(search_task_run_items.run_id, runIds),
      ));
    }
    return json({ status: "fixed", fixed: runIds.length });
  }

  if (action === "fix-stuck-runs") {
    const stuckRunsList = await db.query.search_task_runs.findMany({
      where: and(
        inArray(search_task_runs.status, ["running", "queued", "stopping"]),
        lt(search_task_runs.started_at, new Date(Date.now() - 30 * 60 * 1000)),
      ),
      columns: { id: true, search_task_id: true },
    });
    if (stuckRunsList.length > 0) {
      const stuckIds = stuckRunsList.map((r) => r.id);
      await db.update(search_task_runs).set({
        status: "error",
        error_message: "Timed out (cleaned up by admin)",
        finished_at: new Date(),
      }).where(inArray(search_task_runs.id, stuckIds));
      // Also clean up any pending items on those runs
      await db.update(search_task_run_items).set({
        status: "skipped",
        status_message: "Run timed out",
        processed_at: new Date(),
      }).where(and(
        inArray(search_task_run_items.run_id, stuckIds),
        inArray(search_task_run_items.status, ["pending", "processing"]),
      ));
    }
    return json({ status: "fixed", fixed: stuckRunsList.length });
  }

  if (action === "fix-status-mismatches") {
    const stuckTasksList = await queryRaw<{ id: number }[]>(sql`
      SELECT st.id
      FROM search_tasks st
      WHERE st.status IN ('running', 'queued', 'blocked', 'stopping')
        AND NOT EXISTS (
          SELECT 1 FROM search_task_runs r
          WHERE r.search_task_id = st.id
            AND r.status IN ('running', 'queued', 'stopping')
        )
    `);
    if (stuckTasksList.length > 0) {
      await db.update(search_tasks).set({
        status: "idle",
        status_message: "Reset by admin",
        date_updated: new Date(),
        live_url: null,
      }).where(inArray(search_tasks.id, stuckTasksList.map((t) => t.id)));
    }
    return json({ status: "fixed", fixed: stuckTasksList.length });
  }

  // --- Run actions (require searchTaskId) ---

  if (!searchTaskId) {
    throw error(400, "Missing searchTaskId");
  }

  if (action === "stop") {
    // Remove from queue if waiting
    const removed = await removeWaitingJob(searchTaskId);
    if (removed) {
      const queuedRun = await db.query.search_task_runs.findFirst({
        where: and(
          eq(search_task_runs.search_task_id, searchTaskId),
          eq(search_task_runs.status, "queued"),
        ),
        orderBy: desc(search_task_runs.started_at),
      });
      if (queuedRun) {
        await db.update(search_task_runs).set({
          status: "cancelled",
          error_message: "Cancelled by admin",
          finished_at: new Date(),
        }).where(eq(search_task_runs.id, queuedRun.id));
      }
      await db.update(search_tasks).set({
        status: "idle",
        status_message: null,
        date_updated: new Date(),
      }).where(eq(search_tasks.id, searchTaskId));
      return json({ status: "removed_from_queue" });
    }

    // Stop running job — set to "stopping" and let worker finalize
    const runningRun = await db.query.search_task_runs.findFirst({
      where: and(
        eq(search_task_runs.search_task_id, searchTaskId),
        inArray(search_task_runs.status, ["running", "blocked"]),
      ),
      orderBy: desc(search_task_runs.started_at),
    });

    if (!runningRun) {
      return json({ status: "not_found" });
    }

    await db.update(search_task_runs).set({ status: "stopping" })
      .where(eq(search_task_runs.id, runningRun.id));

    await db.update(search_tasks).set({
      status: "stopping",
      status_message: "Stopping...",
      date_updated: new Date(),
    }).where(eq(search_tasks.id, searchTaskId));

    await removeActiveJob(searchTaskId);

    return json({ status: "cancellation_requested" });
  }

  if (action === "restart") {
    const searchTask = await db.query.search_tasks.findFirst({
      where: eq(search_tasks.id, searchTaskId),
      with: { job_platform: true },
    });

    if (!searchTask) {
      throw error(404, "Search task not found");
    }

    if (!searchTask.search_url || !searchTask.platform_id) {
      throw error(400, "Search task missing URL or platform");
    }

    const [run] = await db.insert(search_task_runs).values({
      search_task_id: searchTaskId,
      status: "queued",
      triggered_by: "user",
      settings: {
        max_jobs: searchTask.max_jobs,
        skip_existing: searchTask.skip_existing,
        skip_first: (searchTask as Record<string, unknown>).skip_first as number | null,
        stop_after_duplicates: (searchTask as Record<string, unknown>).stop_after_duplicates as number | null,
        browser_provider: searchTask.browser_provider,
      },
    }).returning();

    await db.update(search_tasks).set({
      status: "queued",
      status_message: "Waiting in queue (admin restart)",
      date_updated: new Date(),
    }).where(eq(search_tasks.id, searchTaskId));

    let effectiveProvider = searchTask.browser_provider;
    if (!effectiveProvider) {
      const serverDefault = process.env.SJS_BROWSER_PROVIDER || "local";
      if (serverDefault === "goLogin") effectiveProvider = "hosted";
    }

    const job = await addScrapeJob({
      searchTaskId,
      runId: run.id,
      searchUrl: searchTask.search_url,
      platformId: String(searchTask.platform_id),
      triggeredBy: "user",
      browserProvider: effectiveProvider,
      ...(searchTask.search_term ? { searchTerm: searchTask.search_term } : {}),
    });

    await db.update(search_task_runs).set({ bullmq_job_id: job.id })
      .where(eq(search_task_runs.id, run.id));

    return json({ status: "queued", runId: run.id });
  }

  throw error(400, `Unknown action: ${action}`);
};
