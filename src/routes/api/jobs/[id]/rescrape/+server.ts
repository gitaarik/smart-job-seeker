/**
 * Single Job Rescrape API
 *
 * POST /api/jobs/[id]/rescrape - Queue a job for re-scraping
 * GET /api/jobs/[id]/rescrape - Check rescrape status + run history
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  addRescrapeJob,
  isJobRescraping,
} from "$lib/server/queue/rescrape-queue";

/**
 * POST - Trigger rescrape for a job
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const jobId = parseIntParam(params.id, "job");

  // Parse optional overrides from request body
  let overrides: {
    countryCode?: string;
    browserLanguage?: string;
    browserTimezone?: string;
    credentialId?: number;
    browserProvider?: string;
    keepMinimized?: boolean;
  } = {};
  try {
    const body = await request.json();
    if (body.countryCode) overrides.countryCode = body.countryCode;
    if (body.browserLanguage) overrides.browserLanguage = body.browserLanguage;
    if (body.browserTimezone) overrides.browserTimezone = body.browserTimezone;
    if (body.credentialId) overrides.credentialId = Number(body.credentialId);
    if (body.browserProvider) overrides.browserProvider = body.browserProvider;
    if (body.keepMinimized !== undefined) {
      overrides.keepMinimized = body.keepMinimized;
    }
  } catch {
    // No body or invalid JSON — that's fine, all fields are optional
  }

  const job = await db.jobs.findUnique({
    where: { id: jobId },
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

  // Create rescrape run record
  let rescrapeRunId: number | undefined;
  try {
    const run = await db.rescrape_runs.create({
      data: {
        job: jobId,
        status: "queued",
        triggered_by: "user",
        started_at: new Date(),
      },
    });
    rescrapeRunId = run.id;
  } catch {
    // Table may not exist yet — continue without run tracking
  }

  // Add to queue
  const queueJob = await addRescrapeJob({
    jobId: job.id,
    sourceUrl: job.source_url,
    platformId: job.job_platform,
    triggeredBy: "user",
    ...overrides,
    rescrapeRunId,
  });

  // Update run with BullMQ job ID
  if (rescrapeRunId) {
    try {
      await db.rescrape_runs.update({
        where: { id: rescrapeRunId },
        data: { bullmq_job_id: queueJob.id },
      });
    } catch {
      // Ignore
    }
  }

  return json({
    status: "queued",
    message: "Job queued for rescrape",
    queueJobId: queueJob.id,
    rescrapeRunId,
  });
};

/**
 * GET - Check rescrape status + run history
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const jobId = parseIntParam(params.id, "job");

  const job = await db.jobs.findUnique({
    where: { id: jobId },
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

  // Fetch run history (last 10 runs)
  let history: {
    id: number;
    status: string;
    started_at: string;
    finished_at: string | null;
    message: string | null;
  }[] = [];
  try {
    const runs = await db.rescrape_runs.findMany({
      where: { job: jobId },
      select: {
        id: true,
        status: true,
        started_at: true,
        finished_at: true,
        message: true,
      },
      orderBy: { started_at: "desc" },
      take: 10,
    });
    history = runs.map((r) => ({
      id: r.id,
      status: r.status ?? "unknown",
      started_at: (r.started_at as Date)?.toISOString() ??
        new Date().toISOString(),
      finished_at: r.finished_at ? (r.finished_at as Date).toISOString() : null,
      message: r.message,
    }));
  } catch {
    // Table may not exist yet
  }

  return json({
    status: job.rescrape_status || "idle",
    message: job.rescrape_message || null,
    liveUrl: job.rescrape_live_url || null,
    lastUpdated: job.date_updated,
    history,
  });
};
