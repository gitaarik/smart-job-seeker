/**
 * Single Job Rescrape API
 *
 * POST /api/jobs/[id]/rescrape - Queue a job for re-scraping
 * GET /api/jobs/[id]/rescrape - Check rescrape status
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import {
  addRescrapeJob,
  isJobRescraping,
} from "$lib/server/queue/rescrape-queue";

/**
 * POST - Trigger rescrape for a job
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const jobId = parseIntParam(params.id, "job");

  // Get job from database, verify user has a match for it
  const job = await db.jobs.findFirst({
    where: {
      id: jobId,
      job_matches: { some: { profiles: { user_id: user.id } } },
    },
    select: {
      id: true,
      source_url: true,
      job_platform: true,
      title: true,
      rescrape_status: true,
    },
  });

  if (!job) {
    return json({ error: "Job not found" }, { status: 404 });
  }

  if (!job.source_url) {
    return json(
      { error: "Job has no source URL - cannot rescrape" },
      { status: 400 },
    );
  }

  if (!job.job_platform) {
    return json(
      { error: "Job has no platform - cannot rescrape" },
      { status: 400 },
    );
  }

  // Check if already rescraping
  const alreadyRescraping = await isJobRescraping(jobId);
  if (alreadyRescraping) {
    return json({
      status: "already_queued",
      message: "Job is already queued for rescrape",
    });
  }

  // Update job status to queued
  await db.jobs.update({
    where: { id: jobId },
    data: {
      rescrape_status: "queued",
      rescrape_message: "Waiting in queue...",
    },
  });

  // Add to queue
  const queueJob = await addRescrapeJob({
    jobId: job.id,
    sourceUrl: job.source_url,
    platformId: job.job_platform,
    triggeredBy: "user",
  });

  return json({
    status: "queued",
    message: "Job queued for rescrape",
    queueJobId: queueJob.id,
  });
};

/**
 * GET - Check rescrape status
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const jobId = parseIntParam(params.id, "job");

  const job = await db.jobs.findFirst({
    where: {
      id: jobId,
      job_matches: { some: { profiles: { user_id: user.id } } },
    },
    select: {
      id: true,
      rescrape_status: true,
      rescrape_message: true,
      rescrape_live_url: true,
      date_updated: true,
    },
  });

  if (!job) {
    return json({ error: "Job not found" }, { status: 404 });
  }

  return json({
    status: job.rescrape_status || "idle",
    message: job.rescrape_message || null,
    liveUrl: job.rescrape_live_url || null,
    lastUpdated: job.date_updated,
  });
};
