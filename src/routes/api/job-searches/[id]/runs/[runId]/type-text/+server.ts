import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { chromium } from "patchright";

const CLOUD_BROWSER_BASE = "wss://cloudbrowser.gologin.com";

/**
 * POST /api/job-searches/[id]/runs/[runId]/type-text
 *
 * Type text into the browser's currently focused input field via CDP.
 * Used for entering 2FA codes, security codes, etc. on mobile where
 * the GoLogin browser view doesn't trigger the on-screen keyboard.
 *
 * Body: { text: string, submit?: boolean }
 *
 * - text: The text to type (e.g., "123456")
 * - submit: If true, press Enter after typing (default: false)
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const jobSearchId = parseIntParam(params.id, "job search");
  const runId = parseIntParam(params.runId, "run");

  // Parse request body
  let body: { text?: string; submit?: boolean };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  const { text, submit = false } = body;
  if (!text || typeof text !== "string") {
    throw error(400, "Missing or invalid 'text' field");
  }

  // Verify ownership and get job search details
  const jobSearch = await db.job_searches.findFirst({
    where: { id: jobSearchId },
    select: {
      profile: true,
      profiles: { select: { user_id: true, browser_profile_id: true } },
    },
  });

  if (!jobSearch) throw error(404, "Job search not found");
  if (jobSearch.profiles.user_id !== user.id) throw error(403, "Not authorized");

  // Verify run is active
  const run = await db.job_search_runs.findFirst({
    where: { id: runId, job_search_id: jobSearchId },
    select: { status: true },
  });

  if (!run) throw error(404, "Run not found");
  if (!["running", "blocked"].includes(run.status)) {
    throw error(400, `Run is not active (status: ${run.status})`);
  }

  // Get GoLogin profile ID from the user's profile (one browser identity per user)
  const providerProfileId = jobSearch.profiles.browser_profile_id;

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

    // Try to focus a verification/2FA code input field before typing.
    // This saves the user from having to tap the tiny input in the browser view on mobile.
    await page.evaluate(() => {
      // Priority order: find the most likely verification code input
      const selectors = [
        // Common 2FA / verification code inputs
        'input[name="pin"]',
        'input[name="code"]',
        'input[name="otp"]',
        'input[name="verification_code"]',
        'input[name="verificationCode"]',
        'input[name="token"]',
        'input[name="totp"]',
        'input[autocomplete="one-time-code"]',
        // LinkedIn specific
        'input#input__email_verification_pin',
        'input[name="pin"]',
        // Generic: visible text/number/tel inputs that are empty
        'input[type="number"]:not([type="hidden"])',
        'input[type="tel"]:not([type="hidden"])',
      ];

      for (const selector of selectors) {
        const el = document.querySelector<HTMLInputElement>(selector);
        if (el && el.offsetParent !== null && !el.disabled && !el.readOnly) {
          el.focus();
          el.click();
          return;
        }
      }

      // Fallback: find any visible, empty text-like input
      const inputs = document.querySelectorAll<HTMLInputElement>(
        'input[type="text"], input[type="number"], input[type="tel"], input:not([type])'
      );
      for (const el of inputs) {
        if (el.offsetParent !== null && !el.disabled && !el.readOnly && !el.value) {
          el.focus();
          el.click();
          return;
        }
      }
    }).catch(() => {}); // Non-fatal — worst case user still has whatever was focused

    await page.keyboard.type(text, { delay: 50 });

    if (submit) {
      await page.keyboard.press("Enter");
    }

    return json({ success: true, message: `Typed ${text.length} character(s)` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw error(502, `Failed to type text: ${message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};
