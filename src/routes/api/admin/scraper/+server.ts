/**
 * Admin Scraper Runs API
 *
 * GET  - Returns recent search task runs across all users
 * POST - Stop or restart a specific run
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
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
      ? { status: { in: ["running", "queued", "blocked", "stopping"] } }
      : statusFilter === "failed"
        ? { status: { in: ["failed", "cancelled"] } }
        : {};

  // Health checks: detect common issues
  const healthChecks = await getHealthChecks();

  const [runs, totalCount, queueStats] = await Promise.all([
    db.search_task_runs.findMany({
      where: statusWhere,
      orderBy: { started_at: "desc" },
      take: limit,
      skip: offset,
      include: {
        search_tasks: {
          include: {
            profiles: {
              select: {
                id: true,
                name: true,
                user_id: true,
              },
            },
            job_platforms: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    db.search_task_runs.count({ where: statusWhere }),
    getQueueStats(),
  ]);

  // Collect unique user_ids and fetch users separately (no FK relation in schema)
  const userIds = [...new Set(
    runs.map((r) => r.search_tasks.profiles.user_id).filter(Boolean) as string[],
  )];
  const users = userIds.length > 0
    ? await db.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return json({
    runs: runs.map((r) => {
      const u = userMap.get(r.search_tasks.profiles.user_id ?? "");
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
          id: r.search_tasks.id,
          name: searchTaskDisplayName(r.search_tasks.job_platforms?.name, r.search_tasks.note),
          status: r.search_tasks.status,
          browserProvider: r.search_tasks.browser_provider,
          searchUrl: r.search_tasks.search_url,
          platform: r.search_tasks.job_platforms?.name ?? null,
        },
        profile: {
          id: r.search_tasks.profiles.id,
          name: r.search_tasks.profiles.name,
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
    stuckRuns,
    statusMismatches,
  ] = await Promise.all([
    // Completed runs that still have pending/processing items
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT ri.run_id) as count
      FROM search_task_run_items ri
      JOIN search_task_runs r ON r.id = ri.run_id
      WHERE ri.status IN ('pending', 'processing')
        AND r.status IN ('success', 'error', 'cancelled', 'partial')
    `,
    // Runs stuck in running/queued/stopping for more than 30 minutes
    db.search_task_runs.count({
      where: {
        status: { in: ["running", "queued", "stopping"] },
        started_at: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
    }),
    // Search tasks where status says running/queued but latest run is finished
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM search_tasks st
      WHERE st.status IN ('running', 'queued', 'blocked', 'stopping')
        AND NOT EXISTS (
          SELECT 1 FROM search_task_runs r
          WHERE r.search_task_id = st.id
            AND r.status IN ('running', 'queued', 'stopping')
        )
    `,
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
    const result = await db.search_task_run_items.updateMany({
      where: {
        status: { in: ["pending", "processing"] },
        search_task_runs: {
          status: { in: ["success", "error", "cancelled", "partial"] },
        },
      },
      data: {
        status: "skipped",
        status_message: "Cleaned up by admin",
        processed_at: new Date(),
      },
    });
    return json({ status: "fixed", fixed: result.count });
  }

  if (action === "fix-stuck-runs") {
    const stuckRuns = await db.search_task_runs.findMany({
      where: {
        status: { in: ["running", "queued", "stopping"] },
        started_at: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      select: { id: true, search_task_id: true },
    });
    if (stuckRuns.length > 0) {
      await db.search_task_runs.updateMany({
        where: { id: { in: stuckRuns.map((r) => r.id) } },
        data: {
          status: "error",
          error_message: "Timed out (cleaned up by admin)",
          finished_at: new Date(),
        },
      });
      // Also clean up any pending items on those runs
      await db.search_task_run_items.updateMany({
        where: {
          run_id: { in: stuckRuns.map((r) => r.id) },
          status: { in: ["pending", "processing"] },
        },
        data: {
          status: "skipped",
          status_message: "Run timed out",
          processed_at: new Date(),
        },
      });
    }
    return json({ status: "fixed", fixed: stuckRuns.length });
  }

  if (action === "fix-status-mismatches") {
    const stuckTasks = await db.$queryRaw<{ id: number }[]>`
      SELECT st.id
      FROM search_tasks st
      WHERE st.status IN ('running', 'queued', 'blocked', 'stopping')
        AND NOT EXISTS (
          SELECT 1 FROM search_task_runs r
          WHERE r.search_task_id = st.id
            AND r.status IN ('running', 'queued', 'stopping')
        )
    `;
    if (stuckTasks.length > 0) {
      await db.search_tasks.updateMany({
        where: { id: { in: stuckTasks.map((t) => t.id) } },
        data: {
          status: "idle",
          status_message: "Reset by admin",
          date_updated: new Date(),
          live_url: null,
        },
      });
    }
    return json({ status: "fixed", fixed: stuckTasks.length });
  }

  // --- Run actions (require searchTaskId) ---

  if (!searchTaskId) {
    throw error(400, "Missing searchTaskId");
  }

  if (action === "stop") {
    // Remove from queue if waiting
    const removed = await removeWaitingJob(searchTaskId);
    if (removed) {
      const queuedRun = await db.search_task_runs.findFirst({
        where: { search_task_id: searchTaskId, status: "queued" },
        orderBy: { started_at: "desc" },
      });
      if (queuedRun) {
        await db.search_task_runs.update({
          where: { id: queuedRun.id },
          data: {
            status: "cancelled",
            error_message: "Cancelled by admin",
            finished_at: new Date(),
          },
        });
      }
      await db.search_tasks.update({
        where: { id: searchTaskId },
        data: { status: "idle", status_message: null, date_updated: new Date() },
      });
      return json({ status: "removed_from_queue" });
    }

    // Stop running job — set to "stopping" and let worker finalize
    const runningRun = await db.search_task_runs.findFirst({
      where: {
        search_task_id: searchTaskId,
        status: { in: ["running", "blocked"] },
      },
      orderBy: { started_at: "desc" },
    });

    if (!runningRun) {
      return json({ status: "not_found" });
    }

    await db.search_task_runs.update({
      where: { id: runningRun.id },
      data: { status: "stopping" },
    });

    await db.search_tasks.update({
      where: { id: searchTaskId },
      data: {
        status: "stopping",
        status_message: "Stopping...",
        date_updated: new Date(),
      },
    });

    await removeActiveJob(searchTaskId);

    return json({ status: "cancellation_requested" });
  }

  if (action === "restart") {
    const searchTask = await db.search_tasks.findFirst({
      where: { id: searchTaskId },
      include: { job_platforms: true },
    });

    if (!searchTask) {
      throw error(404, "Search task not found");
    }

    if (!searchTask.search_url || !searchTask.platform_id) {
      throw error(400, "Search task missing URL or platform");
    }

    const run = await db.search_task_runs.create({
      data: {
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
      },
    });

    await db.search_tasks.update({
      where: { id: searchTaskId },
      data: {
        status: "queued",
        status_message: "Waiting in queue (admin restart)",
        date_updated: new Date(),
      },
    });

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

    await db.search_task_runs.update({
      where: { id: run.id },
      data: { bullmq_job_id: job.id },
    });

    return json({ status: "queued", runId: run.id });
  }

  throw error(400, `Unknown action: ${action}`);
};
