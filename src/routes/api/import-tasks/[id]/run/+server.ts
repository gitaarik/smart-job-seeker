import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  search_task_run_items,
  search_task_runs,
  search_tasks,
} from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  addScrapeJob,
  getActiveJobForSearch,
  getWaitingJobForSearch,
  removeActiveJob,
  removeWaitingJob,
} from "$lib/server/queue";
import { requireCredits } from "$lib/server/billing/require-credits";
import {
  computeImportTaskBlockers,
  providerRequiresDevice,
} from "$lib/import-tasks/readiness";
import { config } from "$lib/server/config";
import {
  getDeviceById,
  getPreferredDevice,
} from "$lib/server/sjs-browser-status";

/**
 * POST /api/import-tasks/[id]/run
 *
 * Triggers a scrape for the given job search.
 * Creates a run record and adds the job to the BullMQ queue.
 *
 * Response:
 * - { status: 'queued', runId: N } - Job has been queued
 * - { status: 'already_running' } - This search is already running
 * - { status: 'already_queued' } - This search is already in queue
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  // Get the job search and verify ownership
  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    with: {
      profile: true,
      job_platform: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  // Verify the user owns this profile
  if (searchTask.profile.user_id !== user.id) {
    throw error(403, "Not authorized to run this job search");
  }

  const isStaff = !!(user as { is_staff?: boolean }).is_staff ||
    !!(user as { is_admin?: boolean }).is_admin;

  // Pre-check: user needs at least ~15 credits for a minimal scrape
  if (!isStaff) {
    await requireCredits(user.id, 15);
  }

  // Check if this search is already running in BullMQ
  const activeJob = await getActiveJobForSearch(searchTaskId);
  if (activeJob) {
    // Check if the DB thinks it's actually running
    // If DB says idle/error but BullMQ says active, the job is stale — clean it up
    if (
      searchTask.status !== "running" &&
      searchTask.status !== "queued" &&
      searchTask.status !== "blocked"
    ) {
      console.log(
        `[API] Cleaning up stale BullMQ job for search ${searchTaskId} (DB status: ${searchTask.status})`,
      );
      await removeActiveJob(searchTaskId);
    } else {
      return json({ status: "already_running" });
    }
  }

  // Check if already in queue
  const waitingJob = await getWaitingJobForSearch(searchTaskId);
  if (waitingJob) {
    return json({ status: "already_queued" });
  }

  // Validate required fields
  if (!searchTask.platform_id) {
    throw error(400, "Job search has no platform configured");
  }

  // The scraper needs *some* URL to navigate to: either the legacy pre-built
  // search_url on the task, or the platform's search_page_url that the
  // form-fill flow drives. Without either the scraper has no starting page.
  const effectiveSearchUrl = searchTask.search_url ||
    searchTask.job_platform?.search_page_url;
  if (!effectiveSearchUrl) {
    throw error(
      400,
      "Job search has no search URL and the platform has no search page configured",
    );
  }

  // Refuse to start a task that isn't fully configured (e.g. needs a connected
  // device or login credentials). This is the authoritative gate — the detail
  // page and overview list surface the same blockers from the same function,
  // but a task can only actually be launched once it has none.
  let deviceConnected = true;
  if (
    providerRequiresDevice(searchTask.browser_provider, config.browserProvider)
  ) {
    const device = searchTask.sjsbrowser_api_key
      ? await getDeviceById(user.id, searchTask.sjsbrowser_api_key)
      : await getPreferredDevice(user.id);
    deviceConnected = !!device;
  }
  const blockers = computeImportTaskBlockers({
    platformId: searchTask.platform_id,
    platformName: searchTask.job_platform?.name ?? null,
    taskSearchUrl: searchTask.search_url,
    platformSearchPageUrl: searchTask.job_platform?.search_page_url ?? null,
    platformLoginPageUrl: searchTask.job_platform?.login_page_url ?? null,
    loginMode: searchTask.login_mode,
    hasCredential: searchTask.platform_profile_id != null,
    browserProvider: searchTask.browser_provider,
    serverBrowserProvider: config.browserProvider,
    deviceConnected,
  });
  if (blockers.length > 0) {
    throw error(400, blockers.map((b) => b.detail).join(" "));
  }

  // Create a run record with a snapshot of current scraping settings
  const [run] = await db.insert(search_task_runs).values({
    search_task_id: searchTaskId,
    status: "queued",
    triggered_by: "user",
    settings: {
      max_jobs: searchTask.max_jobs,
      skip_existing: searchTask.skip_existing,
      skip_first: searchTask.skip_first,
      stop_after_duplicates:
        (searchTask as Record<string, unknown>).stop_after_duplicates as
          | number
          | null ?? null,
      browser_provider: searchTask.browser_provider,
    },
  }).returning();

  // Update search_tasks status to queued
  await db.update(search_tasks).set({
    status: "queued",
    status_message: "Waiting in queue",
    date_updated: new Date(),
  }).where(eq(search_tasks.id, searchTaskId));

  // Resolve effective browser provider for queue routing.
  // When the search task has no explicit provider, check the server default
  // so GoLogin-default servers route to the hosted queue.
  let effectiveProvider = searchTask.browser_provider;
  if (!effectiveProvider) {
    const serverDefault = process.env.SJS_BROWSER_PROVIDER || "local";
    if (serverDefault === "goLogin") effectiveProvider = "hosted";
  }

  // Add to BullMQ queue (routed to hosted or desktop based on provider)
  const job = await addScrapeJob({
    searchTaskId,
    runId: run.id,
    searchUrl: effectiveSearchUrl,
    platformId: String(searchTask.platform_id),
    triggeredBy: "user",
    browserProvider: effectiveProvider,
    ...(searchTask.search_term ? { searchTerm: searchTask.search_term } : {}),
  });

  // Update run with BullMQ job ID
  await db.update(search_task_runs).set({ bullmq_job_id: job.id })
    .where(eq(search_task_runs.id, run.id));

  // Note: actual credit charging happens in the worker after scrape completion
  // based on dynamic factors (job count, time, cloud browser, etc.)

  console.log(
    `[API] Queued scrape for job search ${searchTaskId}, run ${run.id}, BullMQ job ${job.id}`,
  );

  return json({
    status: "queued",
    runId: run.id,
    jobId: job.id,
    vncUrl: "/vnc/vnc.html?autoconnect=true",
  });
};

/**
 * DELETE /api/import-tasks/[id]/run
 *
 * Cancel a running or queued scrape.
 * GoLogin session cleanup is handled by the worker's failed event handler.
 */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");
  const force = url.searchParams.get("force") === "true";

  // Get the job search and verify ownership
  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    with: {
      profile: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  // Verify the user owns this profile
  if (searchTask.profile.user_id !== user.id) {
    throw error(403, "Not authorized to stop this job search");
  }

  // Force stop: directly cancel a stuck "stopping" run
  if (force) {
    const stoppingRun = await db.query.search_task_runs.findFirst({
      where: and(
        eq(search_task_runs.search_task_id, searchTaskId),
        inArray(search_task_runs.status, ["stopping", "running", "blocked"]),
      ),
      orderBy: desc(search_task_runs.started_at),
    });

    if (stoppingRun) {
      await db.update(search_task_runs).set({
        status: "cancelled",
        error_message: "Force stopped by user",
        finished_at: new Date(),
        live_url: null,
      }).where(eq(search_task_runs.id, stoppingRun.id));

      await db.update(search_task_run_items).set({
        status: "cancelled",
      }).where(and(
        eq(search_task_run_items.run_id, stoppingRun.id),
        inArray(search_task_run_items.status, ["pending", "in_progress"]),
      ));
    }

    await db.update(search_tasks).set({
      status: "idle",
      status_message: "Force stopped by user",
      date_updated: new Date(),
      live_url: null,
    }).where(eq(search_tasks.id, searchTaskId));

    await removeActiveJob(searchTaskId);

    console.log(`[API] Force stopped search ${searchTaskId}`);
    return json({ status: "cancelled" });
  }

  // Try to remove from queue if waiting
  const removed = await removeWaitingJob(searchTaskId);
  if (removed) {
    // Find the queued run and update it
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
        error_message: "Cancelled before start",
        finished_at: new Date(),
      }).where(eq(search_task_runs.id, queuedRun.id));
    }

    await db.update(search_tasks).set({
      status: "idle",
      status_message: null,
      date_updated: new Date(),
    }).where(eq(search_tasks.id, searchTaskId));

    console.log(`[API] Removed queued job for search ${searchTaskId}`);
    return json({ status: "removed_from_queue" });
  }

  // Find the running/blocked run in the database
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

  // Mark as "stopping" so the worker picks it up via isRunCancelled()
  // and the UI shows the in-progress cancellation to all users.
  // The worker will set the final "cancelled" status when it actually stops.
  await db.update(search_task_runs).set({
    status: "stopping",
  }).where(eq(search_task_runs.id, runningRun.id));

  await db.update(search_tasks).set({
    status: "stopping",
    status_message: "Stopping...",
    date_updated: new Date(),
  }).where(eq(search_tasks.id, searchTaskId));

  // The worker's cancel checker (5s poll) detects "stopping" and calls
  // worker.cancelJob() which sends the abort signal to the child process.
  // We do NOT call removeActiveJob() here — it would moveToFailed() in Redis
  // which prevents cancelJob() from delivering the abort signal, leaving the
  // child process running and the run stuck in "stopping" state.

  console.log(`[API] Requested stop for search ${searchTaskId}`);
  return json({ status: "cancellation_requested" });
};

/**
 * GET /api/import-tasks/[id]/run
 *
 * Get the current scrape status for polling
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    with: {
      profile: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  if (searchTask.profile.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  // Get the most recent run
  const latestRun = await db.query.search_task_runs.findFirst({
    where: eq(search_task_runs.search_task_id, searchTaskId),
    orderBy: desc(search_task_runs.started_at),
  });

  return json({
    status: searchTask.status,
    statusMessage: searchTask.status_message,
    lastRun: searchTask.last_run,
    jobsFound: searchTask.last_run_jobs_found,
    liveUrl: latestRun?.live_url || searchTask.live_url,
    currentRunId: latestRun?.id,
    currentRunStatus: latestRun?.status,
    nextScheduledRun:
      (searchTask as Record<string, unknown>).next_scheduled_run ?? null,
  });
};
