import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { search_tasks, search_task_runs } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { chromium } from "patchright";

const CLOUD_BROWSER_BASE = "wss://cloudbrowser.gologin.com";

/**
 * POST /api/import-tasks/[id]/runs/[runId]/navigate-url
 *
 * Navigate the cloud browser to a URL via CDP.
 * Used for magic link login: the user receives a login link via email
 * and pastes it here to open it in the scraper's browser session.
 *
 * Body: { url: string }
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");
  const runId = parseIntParam(params.runId, "run");

  // Parse request body
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    throw error(400, "Missing or invalid 'url' field");
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    throw error(400, "Invalid URL format");
  }

  // Verify ownership and get job search details
  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    columns: {
      profile_id: true,
    },
    with: {
      profile: { columns: { user_id: true, browser_profile_id: true } },
    },
  });

  if (!searchTask) throw error(404, "Job search not found");
  if (searchTask.profile.user_id !== user.id) throw error(403, "Not authorized");

  // Verify run is active
  const run = await db.query.search_task_runs.findFirst({
    where: and(
      eq(search_task_runs.id, runId),
      eq(search_task_runs.search_task_id, searchTaskId),
    ),
    columns: { status: true },
  });

  if (!run) throw error(404, "Run not found");
  if (!["running", "blocked"].includes(run.status)) {
    throw error(400, `Run is not active (status: ${run.status})`);
  }

  // Get GoLogin profile ID from the user's profile
  const providerProfileId = searchTask.profile.browser_profile_id;

  if (!providerProfileId) {
    throw error(400, "No browser profile associated with this profile");
  }

  // Get GoLogin token
  const token = process.env.SJS_GOLOGIN_API_TOKEN;
  if (!token) {
    throw error(500, "GoLogin API token not configured");
  }

  // Connect to the cloud browser via CDP
  const wsUrl = `${CLOUD_BROWSER_BASE}/connect?token=${token}&profile=${providerProfileId}`;
  let browser;

  try {
    browser = await chromium.connectOverCDP(wsUrl, { timeout: 10_000 });
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error("No browser context available");
    }

    const pages = contexts[0].pages();
    const page = pages[0];
    if (!page) {
      throw new Error("No page available in browser");
    }

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    const finalUrl = page.url();
    return json({
      success: true,
      message: `Navigated to URL`,
      url: finalUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw error(502, `Failed to navigate: ${message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};
