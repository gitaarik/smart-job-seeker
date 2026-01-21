/**
 * Unified Job Scraper
 *
 * Single entry point for all job scraping:
 * - With credentials: Browser-Use login → Patchright extraction via CDP
 * - Without credentials: Patchright direct browser → extraction
 */

import { chromium } from "playwright";
import { promises as dns } from "dns";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser-use-client";
import { scrapeJobsWithClicks } from "./click-scraper";
import { interpolatePrompt } from "$lib/server/ai-chat-utils";
import { dbDirect } from "$lib/db";
import { launchBrowser } from "../browser-utils";
import { getPlatformCredentials } from "../platform-auth";
import { promptUser } from "./utils";
import type {
  LoginResult,
  Platform,
  PlatformCredentials,
  ScrapeResult,
} from "./types";

const CDP_HOST = config.hybridCdpHost;
const CDP_PORT = config.hybridCdpPort;

/**
 * Resolve hostname to IP address for CDP connection.
 * Chrome DevTools Protocol rejects non-localhost/non-IP Host headers,
 * so we need to resolve the hostname before connecting.
 */
async function resolveCdpHost(host: string): Promise<string> {
  // If already an IP address or localhost, return as-is
  if (
    host === "localhost" || host === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return host;
  }

  try {
    const addresses = await dns.lookup(host);
    console.log(`🔍 Resolved ${host} to ${addresses.address}`);
    return addresses.address;
  } catch (error) {
    console.warn(`⚠️ Could not resolve ${host}, using as-is: ${error}`);
    return host;
  }
}

/**
 * Handle login result from Browser-Use
 * Consolidates the duplicate logic for processing login attempts
 */
async function handleLoginResult(
  browserUse: BrowserUseClient,
  loginResult: LoginResult,
  platform: Platform,
  searchUrl: string,
): Promise<boolean> {
  if (loginResult.login_success) {
    console.log(`✅ Login successful! URL: ${loginResult.current_url}`);
    return true;
  }

  if (loginResult.captcha_needed) {
    console.log(`\n⚠️ CAPTCHA detected. Manual intervention required.`);
    console.log(`   VNC: localhost:5900`);
    console.log(`   Please solve the CAPTCHA manually.`);
    return waitForManualIntervention(browserUse, platform, searchUrl);
  }

  if (loginResult.verification_needed) {
    console.log(
      `\n🔐 Verification required: ${loginResult.verification_prompt}`,
    );
    return handleVerification(browserUse, loginResult, platform, searchUrl);
  }

  // Login failed for other reason
  console.log(`\n⚠️ Login failed. Manual intervention required.`);
  console.log(`   Error: ${loginResult.error || "Unknown"}`);
  return waitForManualIntervention(browserUse, platform, searchUrl);
}

/**
 * Build login-only task prompt for Browser-Use
 * @param solveCaptcha If true, agent attempts to solve CAPTCHAs. If false (default), reports CAPTCHA_NEEDED for manual solving.
 */
async function buildLoginPrompt(
  platform: { name: string; url: string; login_page_url?: string | null },
  credentials: { username: string; password: string },
  searchUrl: string,
  solveCaptcha: boolean = false,
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
      solveCaptcha: solveCaptcha ? "true" : "false",
    });
    return `${systemPrompt}\n\n${userPrompt}`.trim();
  }

  // Fallback: inline prompt if template not found
  console.warn(
    "⚠️ Prompt 'browser_use_login_only' not found, using inline fallback",
  );

  // Generate CAPTCHA handling instructions based on mode
  const captchaInstructions = solveCaptcha
    ? `STEP 3: If there's a CAPTCHA/human verification challenge:
   - "Verify you're human" checkbox → Click it
   - CAPTCHA puzzle → Attempt to solve it
   - After solving, proceed to click login

STEP 4: Click the login/sign-in button`
    : `STEP 3: BEFORE clicking login, check for CAPTCHA/human verification:
   - "Verify you're human" checkbox
   - "I'm not a robot" checkbox
   - CAPTCHA image/puzzle
   - Cloudflare/Turnstile challenge

   If CAPTCHA IS visible:
   - Report: CAPTCHA_NEEDED: Human verification required before login
   - Do NOT click the login button
   - The user will solve the CAPTCHA manually via VNC

   If NO CAPTCHA visible:
   - Proceed to click the login/sign-in button`;

  return `You are a browser automation assistant. Your task is to log into a website.

STEP 1: Navigate to ${platform.login_page_url || platform.url}

STEP 2: Enter credentials (do this FIRST, before checking for CAPTCHA):
   - Email/Username: ${credentials.username}
   - Password: ${credentials.password}

${captchaInstructions}

AFTER clicking login, check the result:

   a) Verification CODE input (email code, SMS code, 2FA, OTP, authenticator):
      - STOP and report: VERIFICATION_NEEDED: [describe what code is needed]
      - DO NOT enter any code

   b) Another CAPTCHA appeared after login:
      - Report: CAPTCHA_NEEDED: Human verification required after login

   c) Login successful:
      - Navigate to: ${searchUrl}
      - Report: SUCCESS: Currently at [URL]

CRITICAL:
- Enter credentials FIRST, then check for CAPTCHA
- CAPTCHA_NEEDED = visual challenge visible, user must solve via VNC
- VERIFICATION_NEEDED = code input needed (email/SMS/2FA) - you cannot solve this
- NEVER enter a verification code
`;
}

/**
 * Scrape jobs with persistent session + Playwright extraction
 * Uses persistent browser session (like a real browser).
 *
 * Flow:
 * 1. If credentials AND login_page_url configured:
 *    - Proactive login (skip unreliable URL-based session check)
 *    - Sites like Indeed allow browsing without login initially
 * 2. If no proactive login config:
 *    - Check session via URL pattern
 *    - If not logged in: credentials → auto-fill, else → manual login
 * 3. Proceed to scraping
 */
async function scrapeWithLogin(
  searchUrl: string,
  platformId: string,
  platform: { name: string; url: string; login_page_url?: string | null },
  credentials: { username: string; password: string } | null,
  sendScreenshots?: boolean,
  jobSearchId?: number,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
  if (credentials) {
    console.log(`🔐 Credentials found for ${platform.name}`);
  } else {
    console.log(
      `⚠️ No credentials - will require manual login for ${platform.name}`,
    );
  }

  const browserUse = new BrowserUseClient(
    sendScreenshots !== undefined ? { sendScreenshots } : undefined,
  );

  // Determine the login URL pattern for this platform
  const loginUrlPattern = getLoginUrlPattern(platform);

  // Determine login strategy:
  // - If credentials AND login_page_url configured: proactive login (skip unreliable session check)
  // - Otherwise: check session first, then manual login if needed
  const hasProactiveLoginConfig = credentials && platform.login_page_url;

  try {
    let isLoggedIn = false;

    if (hasProactiveLoginConfig) {
      // Proactive login - don't rely on session check for sites that
      // allow unauthenticated browsing (like Indeed)
      console.log(
        "\n📌 Phase 1: Proactive login (credentials + login URL configured)...",
      );
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

      isLoggedIn = await handleLoginResult(
        browserUse,
        loginResult,
        platform,
        searchUrl,
      );
    } else {
      // No proactive login config - check session first
      console.log("\n📌 Phase 1: Checking existing session...");

      const sessionCheck = await browserUse.checkSession(
        searchUrl,
        loginUrlPattern,
        CDP_PORT,
      );

      console.log(
        `   Session exists: ${sessionCheck.session_exists}, Logged in: ${sessionCheck.is_logged_in}`,
      );

      isLoggedIn = sessionCheck.is_logged_in;

      // Phase 2: Handle login if not already logged in
      if (!isLoggedIn) {
        console.log("\n📌 Phase 2: Login required...");

        if (credentials) {
          // We have credentials but no login_page_url - use Browser-Use to auto-fill
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
            startUrl: platform.url,
            cdpPort: CDP_PORT,
            maxTime: config.hybridLoginTimeout / 1000,
            sendScreenshots,
          });

          isLoggedIn = await handleLoginResult(
            browserUse,
            loginResult,
            platform,
            searchUrl,
          );
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
    }

    if (!isLoggedIn) {
      throw new Error("Login failed or cancelled");
    }

    // Phase 2: Handoff delay
    console.log(
      `\n📌 Phase 2: Handoff delay (${config.hybridHandoffDelay}ms)...`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, config.hybridHandoffDelay)
    );

    // Phase 3: Connect Playwright via CDP
    console.log("\n📌 Phase 3: Connecting Playwright via CDP...");

    // Resolve hostname to IP - Chrome DevTools rejects non-IP Host headers
    const resolvedHost = await resolveCdpHost(CDP_HOST);
    const cdpUrl = `http://${resolvedHost}:${CDP_PORT}`;
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

    // Close all tabs except the first one to start fresh
    if (pages.length > 1) {
      console.log(`🧹 Closing ${pages.length - 1} extra tab(s)...`);
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close();
      }
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
      jobSearchId,
    );

    console.log(
      `\n✅ Scraping complete: ${result.jobsProcessed} jobs processed`,
    );

    // Disconnect Playwright (don't close browser - we'll do that via API)
    await browser.close();

    return result;
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
    const verifyResult = await browserUse.submitVerificationCode(
      code,
      CDP_PORT,
    );

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

      let action = "";
      while (action !== "c" && action !== "q") {
        action = (await promptUser(
          "\nAfter solving CAPTCHA, enter 'c' to check login status or 'q' to quit: ",
        )).toLowerCase();
      }
      if (action === "q") return false;

      // Check if login succeeded after manual CAPTCHA solve
      const searchPath = new URL(searchUrl).pathname;
      const waitResult = await browserUse.waitForLogin(
        searchPath,
        CDP_PORT,
        10,
        2,
      );

      if (waitResult.success) {
        console.log("✅ Login successful after manual CAPTCHA!");
        return true;
      } else {
        console.log(
          "⚠️ Still not logged in. Current URL: " + waitResult.current_url,
        );
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
  _browserUse: BrowserUseClient,
  platform: Platform,
  _searchUrl: string,
): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔐 Manual Login Required for ${platform.name}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\nPlease complete login manually:`);
  console.log(`  - VNC: localhost:5900 (connect with VNC viewer)`);
  console.log(`  - Browser CDP: localhost:9222`);

  let confirm = "";
  while (confirm !== "c") {
    confirm = (await promptUser(
      "\nWhen you've completed login, enter 'c' to continue: ",
    )).toLowerCase();
  }

  console.log("✅ Continuing with scrape...");
  return true;
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
 * @param jobSearchId Optional job search ID for Directus URL logging
 * @returns Object with jobsProcessed count and strippedHtml from search page
 */
export async function scrapeJobs(
  searchUrl: string,
  platformId: string,
  profileId?: number,
  sendScreenshots?: boolean,
  jobSearchId?: number,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
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
    jobSearchId,
  );
}
