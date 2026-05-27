/**
 * Debug API — Run Inspector
 *
 * GET /api/debug/run/[id]
 *
 * Returns everything about a scraper run in one response:
 * run details, search task config, profile, items, and logs.
 *
 * Protected by DEBUG_API_KEY (Bearer token). Not session-authenticated —
 * designed for machine-to-machine access from the dev server.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import {
  scraper_log_steps,
  scraper_logs,
  search_task_run_items,
  search_task_runs,
} from "$lib/server/db/schema";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
})();

function requireDebugAuth(request: Request): void {
  const key = process.env.DEBUG_API_KEY;
  if (!key) throw error(503, "Debug API not configured");

  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${key}`) {
    throw error(401, "Invalid or missing debug API key");
  }
}

function detectEnvironment(): string {
  const origin = process.env.ORIGIN || "";
  if (origin.includes("preview.")) return "preview";
  if (origin.includes("www.")) return "production";
  if (origin.includes("dev.")) return "development";
  return "development";
}

export const GET: RequestHandler = async ({ params, request }) => {
  requireDebugAuth(request);

  const runId = parseInt(params.id, 10);
  if (isNaN(runId)) throw error(400, "Invalid run ID");

  // Fetch run with search task and profile in one query
  const run = await db.query.search_task_runs.findFirst({
    where: eq(search_task_runs.id, runId),
    with: {
      search_task: {
        columns: {
          id: true,
          status: true,
          status_message: true,
          search_url: true,
          platform_id: true,
          browser_provider: true,
          search_term: true,
          schedule_interval_hours: true,
          schedule_preferred_hour: true,
          next_scheduled_run: true,
          note: true,
          login_mode: true,
          keep_minimized: true,
          max_jobs: true,
          skip_existing: true,
          stop_after_duplicates: true,
          skip_first: true,
          sjsbrowser_api_key: true,
          stripped_html: true,
        },
        with: {
          profile: {
            columns: { id: true, name: true },
          },
          job_platform: {
            columns: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!run) throw error(404, "Run not found");

  // Fetch items, logs, and step tree in parallel
  const [items, logs, steps] = await Promise.all([
    db.query.search_task_run_items.findMany({
      where: eq(search_task_run_items.run_id, runId),
      orderBy: asc(search_task_run_items.position),
      columns: {
        position: true,
        title: true,
        company: true,
        location: true,
        status: true,
        status_message: true,
        job_id: true,
        was_created: true,
        created_at: true,
        processed_at: true,
      },
    }),
    db.query.scraper_logs.findMany({
      where: eq(scraper_logs.run_id, runId),
      orderBy: asc(scraper_logs.timestamp),
      columns: {
        level: true,
        message: true,
        timestamp: true,
        screenshot_path: true,
        source: true,
        audience: true,
        step_id: true,
        metadata: true,
      },
    }),
    db.query.scraper_log_steps.findMany({
      where: eq(scraper_log_steps.run_id, runId),
      orderBy: asc(scraper_log_steps.started_at),
      columns: {
        id: true,
        parent_step_id: true,
        name: true,
        status: true,
        error_message: true,
        metadata: true,
        started_at: true,
        finished_at: true,
      },
    }),
  ]);

  const { search_task, ...runData } = run;
  const { profile, job_platform, ...taskData } = search_task;

  return json({
    run: {
      id: runData.id,
      status: runData.status,
      errorMessage: runData.error_message,
      startedAt: runData.started_at,
      finishedAt: runData.finished_at,
      jobsFound: runData.jobs_found,
      triggeredBy: runData.triggered_by,
      settings: runData.settings,
    },
    searchTask: {
      ...taskData,
      platformName: job_platform?.name ?? null,
    },
    profile: {
      id: profile.id,
      name: profile.name,
    },
    items,
    logs,
    steps,
    environment: detectEnvironment(),
    version: APP_VERSION,
  });
};
