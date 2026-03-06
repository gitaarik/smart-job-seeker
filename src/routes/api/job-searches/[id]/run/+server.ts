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

// Rate limiting: minimum hours between scrapes (per job search)
const COOLDOWN_HOURS = config.scrapeCooldownHours;
const MAX_RUNS_PER_COOLDOWN = config.scrapeMaxRunsPerCooldown;

/**
 * POST /api/job-searches/[id]/run
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
  const jobSearchId = parseIntParam(params.id, "job search");

  // Get the job search and verify ownership
  const jobSearch = await db.job_searches.findFirst({
    where: { id: jobSearchId },
    include: {
      profiles: true,
      job_platforms: true,
    },
  });

  if (!jobSearch) {
    throw error(404, "Job search not found");
  }

  // Verify the user owns this profile
  if (jobSearch.profiles.user_id !== user.id) {
    throw error(403, "Not authorized to run this job search");
  }

  const isStaff = !!(user as { is_staff?: boolean }).is_staff || !!(user as { is_admin?: boolean }).is_admin;

  // Rate limiting: count recent runs within cooldown period
  const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  const recentRunCount = await db.job_search_runs.count({
    where: {
      job_search_id: jobSearchId,
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

  // Check if this search is already running in BullMQ
  const activeJob = await getActiveJobForSearch(jobSearchId);
  if (activeJob) {
    // Check if the DB thinks it's actually running
    // If DB says idle/error but BullMQ says active, the job is stale — clean it up
    if (
      jobSearch.status !== "running" &&
      jobSearch.status !== "queued" &&
      jobSearch.status !== "blocked"
    ) {
      console.log(
        `[API] Cleaning up stale BullMQ job for search ${jobSearchId} (DB status: ${jobSearch.status})`,
      );
      await removeActiveJob(jobSearchId);
    } else {
      return json({ status: "already_running" });
    }
  }

  // Check if already in queue
  const waitingJob = await getWaitingJobForSearch(jobSearchId);
  if (waitingJob) {
    return json({ status: "already_queued" });
  }

  // Validate required fields
  if (!jobSearch.search_url) {
    throw error(400, "Job search has no search URL configured");
  }

  if (!jobSearch.platform) {
    throw error(400, "Job search has no platform configured");
  }

  // Create a run record
  const run = await db.job_search_runs.create({
    data: {
      job_search_id: jobSearchId,
      status: "queued",
      triggered_by: "user",
    },
  });

  // Update job_searches status to queued
  await db.job_searches.update({
    where: { id: jobSearchId },
    data: {
      status: "queued",
      status_message: "Waiting in queue",
      date_updated: new Date(),
    },
  });

  // Add to BullMQ queue
  const job = await addScrapeJob({
    jobSearchId,
    runId: run.id,
    searchUrl: jobSearch.search_url,
    platformId: String(jobSearch.platform),
    triggeredBy: "user",
  });

  // Update run with BullMQ job ID
  await db.job_search_runs.update({
    where: { id: run.id },
    data: { bullmq_job_id: job.id },
  });

  console.log(
    `[API] Queued scrape for job search ${jobSearchId}, run ${run.id}, BullMQ job ${job.id}`,
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
 * DELETE /api/job-searches/[id]/run
 *
 * Cancel a running or queued scrape.
 * GoLogin session cleanup is handled by the worker's failed event handler.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
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

  // Verify the user owns this profile
  if (jobSearch.profiles.user_id !== user.id) {
    throw error(403, "Not authorized to stop this job search");
  }

  // Try to remove from queue if waiting
  const removed = await removeWaitingJob(jobSearchId);
  if (removed) {
    // Find the queued run and update it
    const queuedRun = await db.job_search_runs.findFirst({
      where: {
        job_search_id: jobSearchId,
        status: "queued",
      },
      orderBy: { started_at: "desc" },
    });

    if (queuedRun) {
      await db.job_search_runs.update({
        where: { id: queuedRun.id },
        data: {
          status: "cancelled",
          error_message: "Cancelled before start",
          finished_at: new Date(),
        },
      });
    }

    await db.job_searches.update({
      where: { id: jobSearchId },
      data: {
        status: "idle",
        status_message: null,
        date_updated: new Date(),
      },
    });

    console.log(`[API] Removed queued job for search ${jobSearchId}`);
    return json({ status: "removed_from_queue" });
  }

  // Find the running/blocked run in the database
  const runningRun = await db.job_search_runs.findFirst({
    where: {
      job_search_id: jobSearchId,
      status: { in: ["running", "blocked"] },
    },
    orderBy: { started_at: "desc" },
  });

  if (!runningRun) {
    return json({ status: "not_found" });
  }

  // Try to force-fail the BullMQ job (best-effort — it may not be found
  // if the worker restarted or BullMQ state diverged, but that's OK)
  await removeActiveJob(jobSearchId);

  // Mark the run as cancelled in the database — this is what the worker
  // checks via isRunCancelled() to stop the scraping process
  await db.job_search_runs.update({
    where: { id: runningRun.id },
    data: {
      status: "cancelled",
      error_message: "Cancelled by user",
      finished_at: new Date(),
      live_url: null,
    },
  });

  // Mark any in-progress or pending run items as cancelled
  await db.job_search_run_items.updateMany({
    where: {
      run_id: runningRun.id,
      status: { in: ["processing", "pending"] },
    },
    data: {
      status: "cancelled",
      status_message: "Cancelled by user",
    },
  });

  await db.job_searches.update({
    where: { id: jobSearchId },
    data: {
      status: "idle",
      status_message: "Cancelled by user",
      date_updated: new Date(),
      live_url: null,
    },
  });

  console.log(`[API] Cancelled running search ${jobSearchId}`);
  return json({ status: "cancelled" });
};

/**
 * GET /api/job-searches/[id]/run
 *
 * Get the current scrape status for polling
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const jobSearchId = parseIntParam(params.id, "job search");

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

  // Get the most recent run
  const latestRun = await db.job_search_runs.findFirst({
    where: { job_search_id: jobSearchId },
    orderBy: { started_at: "desc" },
  });

  return json({
    status: jobSearch.status,
    statusMessage: jobSearch.status_message,
    lastRun: jobSearch.last_run,
    jobsFound: jobSearch.last_run_jobs_found,
    liveUrl: latestRun?.live_url || jobSearch.live_url,
    currentRunId: latestRun?.id,
    currentRunStatus: latestRun?.status,
  });
};
