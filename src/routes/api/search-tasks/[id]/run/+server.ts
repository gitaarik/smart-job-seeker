import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import {
  addScrapeJob,
  getActiveJobForSearch,
  getWaitingJobForSearch,
  removeWaitingJob,
  removeActiveJob,
} from "$lib/server/queue";
import { config } from "$lib/server/config";
import { requireCredits } from "$lib/server/billing/credits";

// Rate limiting: minimum hours between scrapes (per job search)
const COOLDOWN_HOURS = config.scrapeCooldownHours;
const MAX_RUNS_PER_COOLDOWN = config.scrapeMaxRunsPerCooldown;

/**
 * POST /api/search-tasks/[id]/run
 *
 * Triggers a scrape for the given job search.
 * Creates a run record and adds the job to the BullMQ queue.
 *
 * Response:
 * - { status: 'queued', runId: N } - Job has been queued
 * - { status: 'already_running' } - This search is already running
 * - { status: 'already_queued' } - This search is already in queue
 * - { status: 'rate_limited', recentRunCount, cooldownHours } - Too many recent runs
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  // Get the job search and verify ownership
  const searchTask = await db.search_tasks.findFirst({
    where: { id: searchTaskId },
    include: {
      profiles: true,
      job_platforms: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  // Verify the user owns this profile
  if (searchTask.profiles.user_id !== user.id) {
    throw error(403, "Not authorized to run this job search");
  }

  const isStaff = !!(user as { is_staff?: boolean }).is_staff || !!(user as { is_admin?: boolean }).is_admin;

  // Rate limiting: count recent runs within cooldown period
  const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  const recentRunCount = await db.search_task_runs.count({
    where: {
      search_task_id: searchTaskId,
      started_at: { gte: cooldownSince },
    },
  });

  if (recentRunCount >= MAX_RUNS_PER_COOLDOWN && !isStaff) {
    return json({
      status: "rate_limited",
      recentRunCount,
      cooldownHours: COOLDOWN_HOURS,
      maxRuns: MAX_RUNS_PER_COOLDOWN,
    });
  }

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
  if (!searchTask.search_url) {
    throw error(400, "Job search has no search URL configured");
  }

  if (!searchTask.platform) {
    throw error(400, "Job search has no platform configured");
  }

  // Create a run record with a snapshot of current scraping settings
  const run = await db.search_task_runs.create({
    data: {
      search_task_id: searchTaskId,
      status: "queued",
      triggered_by: "user",
      settings: {
        max_jobs: searchTask.max_jobs,
        skip_existing: searchTask.skip_existing,
        skip_first: searchTask.skip_first,
        stop_after_duplicates: (searchTask as Record<string, unknown>).stop_after_duplicates as number | null ?? null,
        browser_provider: searchTask.browser_provider,
      },
    },
  });

  // Update search_tasks status to queued
  await db.search_tasks.update({
    where: { id: searchTaskId },
    data: {
      status: "queued",
      status_message: "Waiting in queue",
      date_updated: new Date(),
    },
  });

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
    searchUrl: searchTask.search_url,
    platformId: String(searchTask.platform),
    triggeredBy: "user",
    browserProvider: effectiveProvider,
    ...(searchTask.search_term ? { searchTerm: searchTask.search_term } : {}),
  });

  // Update run with BullMQ job ID
  await db.search_task_runs.update({
    where: { id: run.id },
    data: { bullmq_job_id: job.id },
  });

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
    // Include run count for staff awareness
    ...(isStaff && recentRunCount >= MAX_RUNS_PER_COOLDOWN
      ? { recentRunCount, cooldownHours: COOLDOWN_HOURS }
      : {}),
  });
};

/**
 * DELETE /api/search-tasks/[id]/run
 *
 * Cancel a running or queued scrape.
 * GoLogin session cleanup is handled by the worker's failed event handler.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
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

  // Verify the user owns this profile
  if (searchTask.profiles.user_id !== user.id) {
    throw error(403, "Not authorized to stop this job search");
  }

  // Try to remove from queue if waiting
  const removed = await removeWaitingJob(searchTaskId);
  if (removed) {
    // Find the queued run and update it
    const queuedRun = await db.search_task_runs.findFirst({
      where: {
        search_task_id: searchTaskId,
        status: "queued",
      },
      orderBy: { started_at: "desc" },
    });

    if (queuedRun) {
      await db.search_task_runs.update({
        where: { id: queuedRun.id },
        data: {
          status: "cancelled",
          error_message: "Cancelled before start",
          finished_at: new Date(),
        },
      });
    }

    await db.search_tasks.update({
      where: { id: searchTaskId },
      data: {
        status: "idle",
        status_message: null,
        date_updated: new Date(),
      },
    });

    console.log(`[API] Removed queued job for search ${searchTaskId}`);
    return json({ status: "removed_from_queue" });
  }

  // Find the running/blocked run in the database
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

  // Mark as "stopping" so the worker picks it up via isRunCancelled()
  // and the UI shows the in-progress cancellation to all users.
  // The worker will set the final "cancelled" status when it actually stops.
  await db.search_task_runs.update({
    where: { id: runningRun.id },
    data: {
      status: "stopping",
    },
  });

  await db.search_tasks.update({
    where: { id: searchTaskId },
    data: {
      status: "stopping",
      status_message: "Stopping...",
      date_updated: new Date(),
    },
  });

  // Try to force-fail the BullMQ job (best-effort — it may not be found
  // if the worker restarted or BullMQ state diverged, but that's OK)
  await removeActiveJob(searchTaskId);

  console.log(`[API] Requested stop for search ${searchTaskId}`);
  return json({ status: "cancellation_requested" });
};

/**
 * GET /api/search-tasks/[id]/run
 *
 * Get the current scrape status for polling
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

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

  // Get the most recent run
  const latestRun = await db.search_task_runs.findFirst({
    where: { search_task_id: searchTaskId },
    orderBy: { started_at: "desc" },
  });

  return json({
    status: searchTask.status,
    statusMessage: searchTask.status_message,
    lastRun: searchTask.last_run,
    jobsFound: searchTask.last_run_jobs_found,
    liveUrl: latestRun?.live_url || searchTask.live_url,
    currentRunId: latestRun?.id,
    currentRunStatus: latestRun?.status,
  });
};
