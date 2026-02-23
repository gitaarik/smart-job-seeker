import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * POST /api/job-searches/[id]/run
 *
 * Triggers a scrape for the given job search.
 * Returns immediately - the scrape runs in the background.
 *
 * Response:
 * - { status: 'started' } - Scrape has been started
 * - { status: 'already_running' } - This search is already running
 * - { status: 'queued', position: N } - Another scrape is running, this one is queued
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const jobSearchId = parseInt(params.id);
  if (isNaN(jobSearchId)) {
    throw error(400, "Invalid job search ID");
  }

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

  // Check if this search is already running
  if (jobSearch.last_run_status === "running") {
    return json({ status: "already_running" });
  }

  // Check if any other search is currently running (single-browser limitation)
  const runningSearch = await db.job_searches.findFirst({
    where: {
      last_run_status: "running",
      id: { not: jobSearchId },
    },
  });

  if (runningSearch) {
    // Queue this search - for now just mark it as queued
    // TODO: Implement proper queue with scrape_queue table
    return json({
      status: "queued",
      message: "Another scrape is currently running. Please wait.",
    });
  }

  // Validate required fields
  if (!jobSearch.search_url) {
    throw error(400, "Job search has no search URL configured");
  }

  if (!jobSearch.platform) {
    throw error(400, "Job search has no platform configured");
  }

  // Mark as running immediately so UI updates
  await db.job_searches.update({
    where: { id: jobSearchId },
    data: {
      last_run_status: "running",
      last_run_error: null,
      date_updated: new Date(),
    },
  });

  // Trigger the scrape in background via the scraper service
  // We call the scraper container's API or use a message queue
  // For now, we'll use a simple HTTP call to the scraper service
  triggerScrapeAsync(jobSearchId, jobSearch.search_url, jobSearch.platform);

  return json({
    status: "started",
    vncUrl: "/vnc/vnc.html?autoconnect=true",
  });
};

/**
 * Trigger the scrape asynchronously without blocking the response.
 * This calls the scraper worker to pick up the job.
 */
async function triggerScrapeAsync(
  jobSearchId: number,
  searchUrl: string,
  platformId: number
): Promise<void> {
  // For now, we rely on the scraper worker to pick up jobs with status="running"
  // The worker polls every 60 seconds, but we can also add a direct trigger later

  // Future improvement: Add a /trigger endpoint to the scraper service
  // or use Redis pub/sub for instant notification

  console.log(`[API] Triggered scrape for job search ${jobSearchId}`);
}

/**
 * GET /api/job-searches/[id]/run
 *
 * Get the current scrape status for polling
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const jobSearchId = parseInt(params.id);
  if (isNaN(jobSearchId)) {
    throw error(400, "Invalid job search ID");
  }

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

  return json({
    status: jobSearch.last_run_status,
    error: jobSearch.last_run_error,
    lastRun: jobSearch.last_run,
    jobsFound: jobSearch.last_run_jobs_found,
  });
};
