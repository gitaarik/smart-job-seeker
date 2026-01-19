/**
 * Unified Job Scraper
 *
 * Single entry point for all job scraping:
 * - With credentials: Browser-Use login → Patchright extraction via CDP
 * - Without credentials: Patchright direct browser → extraction
 */

import { chromium } from "playwright";
import * as readline from "readline";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser-use-client";
import { scrapeJobsWithClicks } from "./click-scraper";
import { interpolatePrompt } from "$lib/server/ai-chat-utils";
import { dbDirect } from "$lib/db";
import { launchBrowser } from "../browser-utils";
import { getPlatformCredentials } from "../platform-auth";

const CDP_PORT = 9222;

/**
 * Prompt user for input via CLI
 */
async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Build login-only task prompt for Browser-Use
 */
async function buildLoginPrompt(
  platform: { name: string; url: string; login_page_url?: string | null },
  credentials: { username: string; password: string },
  searchUrl: string,
): Promise<string> {
  // Try to fetch the login-only prompt from Directus
  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "browser_use_login_only" },
  });

  if (promptTemplate) {
    const systemPrompt = promptTemplate.system_prompt || "";
    const userPrompt = interpolatePrompt(promptTemplate.user_prompt || "", {
      platformUrl: platform.login_page_url || platform.url,
      platformName: platform.name,
      username: credentials.username,
      password: credentials.password,
      searchUrl,
    });
    return `${systemPrompt}\n\n${userPrompt}`.trim();
  }

  // Fallback: inline prompt if template not found
  console.warn(
    "⚠️ Prompt 'browser_use_login_only' not found, using inline fallback",
  );

  return `You are a browser automation assistant. Your task is to log into a website.

STEP 1: Navigate to ${platform.login_page_url || platform.url}

STEP 2: Enter credentials:
   - Email/Username: ${credentials.username}
   - Password: ${credentials.password}

STEP 3: Click the login/sign-in button

STEP 4: Handle any challenges:

   a) CAPTCHA / "Verify you're human" checkbox (Cloudflare, reCAPTCHA, etc.):
      - Click the checkbox or complete the challenge
      - These are automated anti-bot checks - TRY TO SOLVE THEM
      - Continue with login after solving

   b) Verification CODE input (email code, SMS code, 2FA, OTP, authenticator):
      - This is asking for a code sent to the user's email/phone or from an authenticator app
      - DO NOT enter any code - you don't have access to the user's email/phone/authenticator
      - DO NOT guess or make up codes
      - STOP IMMEDIATELY and report: VERIFICATION_NEEDED: [describe what code is needed]

STEP 5: After login (if no verification code was needed):
   - Navigate to: ${searchUrl}
   - Report: SUCCESS: Currently at [URL]

CRITICAL RULES:
- CAPTCHA/human verification checkboxes → TRY TO SOLVE THEM, then proceed
- Verification CODES (email, SMS, 2FA, OTP) → STOP and report VERIFICATION_NEEDED
- The difference: CAPTCHAs are visual challenges you can solve. Codes require access to user's email/phone which you don't have.
- NEVER enter a verification code - this will be handled separately
- NEVER guess or make up codes
`;
}

/**
 * Scrape jobs with persistent session + Playwright extraction
 * Uses persistent browser session (like a real browser).
 *
 * Flow:
 * 1. Check if session is valid (already logged in)
 * 2. If logged in, skip login and proceed to scraping
 * 3. If not logged in:
 *    - If credentials exist: auto-fill, pause for manual CAPTCHA/verification if needed
 *    - If no credentials: pause for manual login
 * 4. Proceed to scraping
 */
async function scrapeWithLogin(
  searchUrl: string,
  platformId: string,
  platform: { name: string; url: string; login_page_url?: string | null },
  credentials: { username: string; password: string } | null,
  sendScreenshots?: boolean,
): Promise<number> {
  if (credentials) {
    console.log(`🔐 Credentials found for ${platform.name}`);
  } else {
    console.log(`⚠️ No credentials - will require manual login for ${platform.name}`);
  }

  const browserUse = new BrowserUseClient(
    sendScreenshots !== undefined ? { sendScreenshots } : undefined,
  );

  // Determine the login URL pattern for this platform
  const loginUrlPattern = getLoginUrlPattern(platform);

  try {
    // Phase 1: Check if we already have a valid session
    console.log("\n📌 Phase 1: Checking existing session...");

    const sessionCheck = await browserUse.checkSession(
      searchUrl,
      loginUrlPattern,
      CDP_PORT,
    );

    console.log(
      `   Session exists: ${sessionCheck.session_exists}, Logged in: ${sessionCheck.is_logged_in}`,
    );

    let isLoggedIn = sessionCheck.is_logged_in;

    // Phase 2: Handle login if not already logged in
    if (!isLoggedIn) {
      console.log("\n📌 Phase 2: Login required...");

      if (credentials) {
        // We have credentials - use Browser-Use to auto-fill
        console.log("   Auto-filling credentials...");

        const loginTask = await buildLoginPrompt(
          platform,
          credentials,
          searchUrl,
        );

        console.log("📝 Login task preview:");
        console.log(loginTask.substring(0, 300) + "...");

        const loginResult = await browserUse.startHybridSession({
          task: loginTask,
          startUrl: platform.login_page_url || platform.url,
          cdpPort: CDP_PORT,
          maxTime: config.hybridLoginTimeout / 1000,
          sendScreenshots,
        });

        // Check if login succeeded or needs manual intervention
        if (loginResult.login_success) {
          console.log(`✅ Login successful! URL: ${loginResult.current_url}`);
          isLoggedIn = true;
        } else if (loginResult.verification_needed) {
          // Verification code needed - prompt user
          console.log(
            `\n🔐 Verification required: ${loginResult.verification_prompt}`,
          );
          isLoggedIn = await handleVerification(
            browserUse,
            loginResult,
            platform,
            searchUrl,
          );
        } else {
          // Login failed - likely CAPTCHA, ask user for manual intervention
          console.log(
            `\n⚠️ Login failed (likely CAPTCHA). Manual intervention required.`,
          );
          console.log(`   Error: ${loginResult.error || "Unknown"}`);
          isLoggedIn = await waitForManualIntervention(
            browserUse,
            platform,
            searchUrl,
          );
        }
      } else {
        // No credentials - start browser for manual login
        console.log("   Starting browser for manual login...");

        await browserUse.startSession(
          platform.login_page_url || platform.url,
          CDP_PORT,
        );

        isLoggedIn = await waitForManualIntervention(
          browserUse,
          platform,
          searchUrl,
        );
      }
    } else {
      console.log("✅ Already logged in, skipping login phase");
    }

    if (!isLoggedIn) {
      throw new Error("Login failed or cancelled");
    }

    // Phase 3: Handoff delay
    console.log(
      `\n📌 Phase 3: Handoff delay (${config.hybridHandoffDelay}ms)...`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, config.hybridHandoffDelay)
    );

    // Phase 4: Connect Playwright via CDP
    console.log("\n📌 Phase 4: Connecting Playwright via CDP...");

    const cdpUrl = `http://localhost:${CDP_PORT}`;
    const browser = await chromium.connectOverCDP(cdpUrl);
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      throw new Error("No browser context available after CDP connection");
    }

    const context = contexts[0];
    const pages = context.pages();

    if (pages.length === 0) {
      throw new Error("No pages available in browser context");
    }

    const page = pages[0];
    const currentUrl = page.url();
    console.log(`📄 Connected to page: ${currentUrl}`);

    // Navigate to search URL if not already there
    const searchPath = new URL(searchUrl).pathname;
    if (!currentUrl.includes(searchPath)) {
      console.log(`🔄 Navigating to search results: ${searchUrl}`);
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }

    // Phase 5: Playwright extraction
    console.log("\n📌 Phase 5: Job extraction...");

    const result = await scrapeJobsWithClicks(
      page,
      searchUrl,
      platformId,
      undefined, // Don't pass profileId - already logged in
    );

    console.log(
      `\n✅ Scraping complete: ${result.jobsProcessed} jobs processed`,
    );

    // Disconnect Playwright (don't close browser - we'll do that via API)
    await browser.close();

    return result.jobsProcessed;
  } finally {
    // Always close the hybrid session
    console.log("\n🧹 Closing browser session...");
    await browserUse.closeHybridSession();
  }
}

/**
 * Get the login URL pattern for a platform
 * Used to detect if we're on a login page (not logged in)
 */
function getLoginUrlPattern(platform: {
  name: string;
  url: string;
  login_page_url?: string | null;
}): string {
  // Common login URL patterns per platform
  const name = platform.name.toLowerCase();

  if (name.includes("linkedin")) return "/login";
  if (name.includes("indeed")) return "/account/login";
  if (name.includes("glassdoor")) return "/member/signIn";
  if (name.includes("workday")) return "/login";

  // Default: extract path from login_page_url if available
  if (platform.login_page_url) {
    try {
      return new URL(platform.login_page_url).pathname;
    } catch {
      // Ignore parse errors
    }
  }

  // Fallback to common patterns
  return "/login";
}

/**
 * Handle verification code flow
 */
async function handleVerification(
  browserUse: BrowserUseClient,
  loginResult: { verification_prompt?: string; verification_type?: string },
  platform: { name: string },
  searchUrl: string,
): Promise<boolean> {
  console.log(`   Type: ${loginResult.verification_type}`);

  while (true) {
    const code = await promptUser("\n📝 Enter verification code: ");

    if (!code) {
      const cancel = await promptUser("No code entered. Cancel login? (y/n): ");
      if (cancel.toLowerCase() === "y") {
        return false;
      }
      continue;
    }

    console.log("⏳ Submitting verification code...");
    const verifyResult = await browserUse.submitVerificationCode(code, CDP_PORT);

    if (verifyResult.login_complete) {
      console.log("✅ Verification successful!");
      return true;
    } else if (verifyResult.captcha_needed) {
      // CAPTCHA appeared after code submission - need manual intervention
      console.log(
        "\n⚠️ CAPTCHA/human verification appeared. Please solve it manually.",
      );
      console.log(`   VNC: localhost:5900`);
      console.log(`   Browser CDP: localhost:9222`);

      const action = await promptUser(
        "\nAfter solving CAPTCHA, press Enter to check login status (or 'q' to quit): ",
      );
      if (action.toLowerCase() === "q") return false;

      // Check if login succeeded after manual CAPTCHA solve
      const searchPath = new URL(searchUrl).pathname;
      const waitResult = await browserUse.waitForLogin(searchPath, CDP_PORT, 10, 2);

      if (waitResult.success) {
        console.log("✅ Login successful after manual CAPTCHA!");
        return true;
      } else {
        console.log("⚠️ Still not logged in. Current URL: " + waitResult.current_url);
        const retry = await promptUser("Continue waiting? (y/n): ");
        if (retry.toLowerCase() !== "y") return false;
        // Loop back to wait for manual intervention
        return waitForManualIntervention(browserUse, platform, searchUrl);
      }
    } else if (verifyResult.needs_new_code) {
      const retry = await promptUser("⚠️ Code expired. Resend? (y/n): ");
      if (retry.toLowerCase() === "y") {
        console.log("📧 Requesting new code...");
        await browserUse.resendVerificationCode(CDP_PORT);
        console.log("✅ New code sent.");
      } else {
        return false;
      }
    } else {
      const retry = await promptUser("❌ Code incorrect. Try again? (y/n): ");
      if (retry.toLowerCase() !== "y") return false;
    }
  }
}

/**
 * Wait for user to complete login manually
 */
async function waitForManualIntervention(
  browserUse: BrowserUseClient,
  platform: { name: string },
  searchUrl: string,
): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔐 Manual Login Required for ${platform.name}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\nPlease complete login manually:`);
  console.log(`  - VNC: localhost:5900 (connect with VNC viewer)`);
  console.log(`  - Browser CDP: localhost:9222`);
  console.log(`\nWaiting for login... (timeout: 5 min)\n`);

  // Extract the path pattern for success detection
  const searchPath = new URL(searchUrl).pathname;

  const waitResult = await browserUse.waitForLogin(
    searchPath,
    CDP_PORT,
    300, // 5 minutes
    5, // check every 5 seconds
  );

  if (waitResult.success) {
    console.log("✅ Login detected!");
    return true;
  } else if (waitResult.timed_out) {
    console.log("⚠️ Login timeout. Do you want to continue waiting?");
    const retry = await promptUser("Continue waiting? (y/n): ");
    if (retry.toLowerCase() === "y") {
      return waitForManualIntervention(browserUse, platform, searchUrl);
    }
  }

  return false;
}

/**
 * Scrape jobs with Patchright only (no login)
 * Used when no credentials are available
 */
async function scrapeWithoutLogin(
  searchUrl: string,
  platformId: string,
  profileId?: number,
): Promise<number> {
  console.log(`\n🎭 Using Patchright (no login)...`);

  // Launch browser with fingerprint (headed mode for debugging)
  const context = await launchBrowser({ headless: false });

  try {
    const page = await context.newPage();

    // Navigate to search URL
    console.log(`\n🌐 Navigating to: ${searchUrl}`);
    await page.goto(searchUrl);
    await page.waitForLoadState("domcontentloaded");

    // Use click-based scraper
    const result = await scrapeJobsWithClicks(
      page,
      searchUrl,
      platformId,
      profileId,
    );

    console.log(
      `\n✅ Scraping complete: ${result.jobsProcessed} jobs processed`,
    );

    return result.jobsProcessed;
  } finally {
    // Always close browser context
    await context.close();
  }
}

/**
 * Scrape jobs from a search URL
 *
 * Unified entry point that handles all scraping scenarios:
 * - With credentials: Auto-fill credentials, pause for manual CAPTCHA/verification if needed
 * - Without credentials: Pause for manual login via VNC
 * - Already logged in (persistent session): Skip login entirely
 *
 * Uses persistent browser sessions - once logged in, subsequent runs skip login.
 *
 * @param searchUrl URL of the job search results page
 * @param platformId Platform ID for job storage
 * @param profileId Optional profile ID for credentials
 * @param sendScreenshots Whether to send screenshots to LLM (for login)
 * @returns Number of jobs processed
 */
export async function scrapeJobs(
  searchUrl: string,
  platformId: string,
  profileId?: number,
  sendScreenshots?: boolean,
): Promise<number> {
  console.log(`\n🔍 Starting job scraper (with persistent sessions)...`);

  // Get platform information
  const platform = await dbDirect.job_platforms.findUnique({
    where: { id: Number(platformId) },
  });

  if (!platform) {
    throw new Error(`Platform with ID ${platformId} not found`);
  }

  // Check if we have credentials for auto-fill
  let credentials: { username: string; password: string } | null = null;

  if (profileId) {
    const creds = await getPlatformCredentials(profileId, Number(platformId));
    if (creds?.username && creds?.password) {
      credentials = { username: creds.username, password: creds.password };
    }
  }

  // Always use scrapeWithLogin - it handles:
  // 1. Session check (skip login if already logged in)
  // 2. Auto-fill with credentials (if available)
  // 3. Manual login via VNC (if no credentials or CAPTCHA fails)
  return scrapeWithLogin(
    searchUrl,
    platformId,
    platform,
    credentials,
    sendScreenshots,
  );
}
