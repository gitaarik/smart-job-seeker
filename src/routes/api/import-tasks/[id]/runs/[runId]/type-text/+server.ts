import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { chromium } from "patchright";

const CLOUD_BROWSER_BASE = "wss://cloudbrowser.gologin.com";

/**
 * POST /api/import-tasks/[id]/runs/[runId]/type-text
 *
 * Type text into the browser's currently focused input field via CDP.
 * Used for entering 2FA codes, security codes, etc. on mobile where
 * the GoLogin browser view doesn't trigger the on-screen keyboard.
 *
 * Body: { text?: string, submit?: boolean, clear?: boolean }
 *
 * - text: The text to type (e.g., "123456")
 * - submit: If true, click submit button or press Enter (default: false)
 * - clear: If true, select all and delete text in focused input (default: false)
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");
  const runId = parseIntParam(params.runId, "run");

  // Parse request body
  let body: { text?: string; submit?: boolean; clear?: boolean };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  const { text = "", submit = false, clear = false } = body;
  if (!text && !submit && !clear) {
    throw error(400, "Must provide text, submit, or clear");
  }

  // Verify ownership and get job search details
  const searchTask = await db.search_tasks.findFirst({
    where: { id: searchTaskId },
    select: {
      profile: true,
      profiles: { select: { user_id: true, browser_profile_id: true } },
    },
  });

  if (!searchTask) throw error(404, "Job search not found");
  if (searchTask.profiles.user_id !== user.id) throw error(403, "Not authorized");

  // Verify run is active
  const run = await db.search_task_runs.findFirst({
    where: { id: runId, search_task_id: searchTaskId },
    select: { status: true },
  });

  if (!run) throw error(404, "Run not found");
  if (!["running", "blocked"].includes(run.status)) {
    throw error(400, `Run is not active (status: ${run.status})`);
  }

  // Get GoLogin profile ID from the user's profile (one browser identity per user)
  const providerProfileId = searchTask.profiles.browser_profile_id;

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

    if (clear) {
      // Select all text in the focused input and delete it
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");
      return json({ success: true, message: "Cleared input" });
    }

    if (text) {
      await page.keyboard.type(text, { delay: 50 });
    }

    if (submit) {
      // Try clicking a submit button first (more reliable than Enter on many forms).
      // Fall back to pressing Enter if no submit button is found.
      const clicked = await page.evaluate(() => {
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button#submit',
          // LinkedIn specific
          'button[data-litms-control-urn*="submit"]',
          'button.btn__primary--large',
        ];
        for (const sel of submitSelectors) {
          const btn = document.querySelector<HTMLElement>(sel);
          if (btn && btn.offsetParent !== null && !(btn as HTMLButtonElement).disabled) {
            btn.click();
            return true;
          }
        }
        // Fallback: find a visible button containing "submit" or "verify" text
        const buttons = document.querySelectorAll<HTMLButtonElement>("button");
        for (const btn of buttons) {
          const t = (btn.textContent || "").trim().toLowerCase();
          if (btn.offsetParent !== null && !btn.disabled &&
              (t === "submit" || t === "verify" || t === "send" || t === "confirm")) {
            btn.click();
            return true;
          }
        }
        return false;
      }).catch(() => false);

      if (!clicked) {
        await page.keyboard.press("Enter");
      }
      // Wait briefly so the form submission processes before we disconnect CDP
      await new Promise((r) => setTimeout(r, 1000));
    }

    const parts = [];
    if (text) parts.push(`typed ${text.length} char(s)`);
    if (submit) parts.push("submitted");
    return json({ success: true, message: parts.join(" and ") || "Done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw error(502, `Failed to type text: ${message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};
