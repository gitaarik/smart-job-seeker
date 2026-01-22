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
import { BrowserUseClient } from "$lib/server/browser/use-client";
import { scrapeJobsWithClicks } from "./extraction";
import { interpolatePrompt } from "$lib/server/ai-chat/utils";
import { createJobScrapingAiChat } from "$lib/server/ai-chat/job-utils";
import { stripHtmlForLlm } from "$lib/server/html/strip";
import { dbDirect } from "$lib/db";
import { getPlatformCredentials } from "../auth/platform";
import { promptUser } from "./utils";
import type { LoginResult, Platform, PlatformCredentials } from "./types";

const CDP_HOST = config.cdpHost;
const CDP_PORT = config.cdpPort;

/**
 * Check if an error is a recoverable browser-use error that should trigger manual login fallback.
 * These are typically timeout/CDP issues, not auth failures.
 */
function isRecoverableBrowserUseError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const lowerMsg = errorMsg.toLowerCase();

  // CDP/connection issues
  if (lowerMsg.includes("cdp") && lowerMsg.includes("unresponsive")) {
    return true;
  }
  if (lowerMsg.includes("websocket") && lowerMsg.includes("closed")) {
    return true;
  }

  // Timeout issues (watchdog timeouts, general timeouts)
  if (lowerMsg.includes("timeout")) return true;
  if (lowerMsg.includes("timed out")) return true;

  // Watchdog-specific errors
  if (lowerMsg.includes("watchdog")) return true;
  if (lowerMsg.includes("domwatchdog")) return true;
  if (lowerMsg.includes("screenshotwatchdog")) return true;

  // Event bus errors
  if (lowerMsg.includes("eventbus")) return true;
  if (lowerMsg.includes("event bus")) return true;

  // Connection failures
  if (lowerMsg.includes("connection failed")) return true;
  if (lowerMsg.includes("connection refused")) return true;

  return false;
}

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
 * Check login state by navigating to the login page.
 *
 * Logic:
 * 1. Navigate to login_page_url
 * 2. Check if URL changed (redirect indicates logged in)
 * 3. Use LLM to verify by analyzing page content
 *
 * @returns Object with isLoggedIn status and current URL
 */
async function checkLoginByNavigation(
  browserUse: BrowserUseClient,
  loginPageUrl: string,
  jobSearchId: number,
  cdpPort: number = CDP_PORT,
): Promise<{ isLoggedIn: boolean; currentUrl: string }> {
  console.log(`\n🔍 Checking login state by navigating to: ${loginPageUrl}`);

  // Navigate to login page
  const navResult = await browserUse.navigateTo(loginPageUrl, cdpPort);

  if (!navResult.success) {
    console.log(`   ❌ Navigation failed, assuming not logged in`);
    return { isLoggedIn: false, currentUrl: "" };
  }

  console.log(`   📍 Current URL after navigation: ${navResult.current_url}`);

  // Check if URL changed (redirect)
  const originalUrl = new URL(loginPageUrl);
  const currentUrl = new URL(navResult.current_url);
  const urlChanged = currentUrl.pathname !== originalUrl.pathname;

  if (urlChanged) {
    console.log(
      `   🔀 URL changed - likely redirected (user may be logged in)`,
    );
  } else {
    console.log(`   📍 Still on login page path`);
  }

  // Use LLM to verify login state by analyzing page content
  console.log(`   🤖 Asking LLM to verify login state...`);

  const strippedHtml = stripHtmlForLlm(
    `<html><body>${navResult.page_text}</body></html>`,
  );

  const llmResult = await createJobScrapingAiChat<{
    is_logged_in: boolean;
    confidence: "high" | "medium" | "low";
    reason: string;
  }>(jobSearchId, "check_login_state", {
    loginPageUrl,
    currentUrl: navResult.current_url,
    urlChanged: urlChanged ? "yes" : "no",
    strippedHtml,
  });

  if (!llmResult.success || !llmResult.response) {
    // LLM failed, fall back to URL-based detection
    console.log(`   ⚠️ LLM verification failed, using URL-based fallback`);
    return { isLoggedIn: urlChanged, currentUrl: navResult.current_url };
  }

  const { is_logged_in, confidence, reason } = llmResult.response;
  console.log(
    `   ${is_logged_in ? "✅" : "❌"} LLM result: ${
      is_logged_in ? "logged in" : "not logged in"
    } (${confidence} confidence)`,
  );
  console.log(`   📝 Reason: ${reason}`);

  return { isLoggedIn: is_logged_in, currentUrl: navResult.current_url };
}

/**
 * Handle login result from Browser-Use
 * Consolidates the duplicate logic for processing login attempts
 *
 * @param isCloudMode If true, skip manual VNC prompts (Cloud handles CAPTCHA automatically)
 */
async function handleLoginResult(
  browserUse: BrowserUseClient,
  loginResult: LoginResult,
  platform: Platform,
  searchUrl: string,
  isCloudMode: boolean = false,
): Promise<boolean> {
  if (loginResult.login_success) {
    console.log(`✅ Login successful! URL: ${loginResult.current_url}`);
    return true;
  }

  // In cloud mode, CAPTCHA should be handled automatically
  // If we still get captcha_needed, something went wrong
  if (loginResult.captcha_needed) {
    if (isCloudMode) {
      console.error(
        `❌ Cloud mode: CAPTCHA was not solved automatically. Check the live URL for details.`,
      );
      if (loginResult.live_url) {
        console.log(`📺 Live URL: ${loginResult.live_url}`);
      }
      return false;
    }

    console.log(`\n⚠️ CAPTCHA detected. Manual intervention required.`);
    console.log(`   VNC: localhost:5900`);
    console.log(`   Please solve the CAPTCHA manually.`);
    return waitForManualIntervention(platform);
  }

  if (loginResult.verification_needed) {
    console.log(
      `\n🔐 Verification required: ${loginResult.verification_prompt}`,
    );
    return handleVerification(browserUse, loginResult, platform, searchUrl);
  }

  // Login failed for other reason
  if (isCloudMode) {
    console.error(`❌ Cloud login failed: ${loginResult.error || "Unknown"}`);
    if (loginResult.live_url) {
      console.log(`📺 Live URL: ${loginResult.live_url}`);
    }
    return false;
  }

  console.log(`\n⚠️ Login failed. Manual intervention required.`);
  console.log(`   Error: ${loginResult.error || "Unknown"}`);
  return waitForManualIntervention(platform);
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
  const promptKey = solveCaptcha
    ? "browser_use_login_solve_captcha"
    : "browser_use_login_report_captcha";

  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: promptKey },
  });

  if (!promptTemplate?.user_prompt) {
    throw new Error(`Prompt '${promptKey}' not found in database`);
  }

  const userPrompt = interpolatePrompt(promptTemplate.user_prompt, {
    platformUrl: platform.login_page_url || platform.url,
    platformName: platform.name,
    username: credentials.username,
    password: credentials.password,
    searchUrl,
  });

  const systemPrompt = promptTemplate.system_prompt || "";
  return `${systemPrompt}\n\n${userPrompt}`.trim();
}

/**
 * Execute auto-login with Browser-Use.
 * Builds the login prompt, starts a login session, and handles the result.
 *
 * @returns Object with success flag and optional cdp_url (for cloud mode)
 */
async function attemptAutoLogin(
  browserUse: BrowserUseClient,
  platform: Platform,
  credentials: PlatformCredentials,
  searchUrl: string,
  startUrl: string,
  useVision: boolean | undefined,
): Promise<{ success: boolean; cdpUrl?: string }> {
  const loginTask = await buildLoginPrompt(platform, credentials, searchUrl);

  console.log("📝 Login task preview:");
  console.log(loginTask.substring(0, 300) + "...");

  const loginResult = await browserUse.login({
    task: loginTask,
    startUrl,
    cdpPort: CDP_PORT,
    maxTime: config.loginTimeout / 1000,
    useVision,
  });

  const isCloudMode = !!loginResult.cdp_url;
  const success = await handleLoginResult(
    browserUse,
    loginResult,
    platform,
    searchUrl,
    isCloudMode,
  );

  return {
    success,
    cdpUrl: loginResult.cdp_url,
  };
}

/**
 * Scrape jobs with persistent session + Playwright extraction
 * Uses persistent browser session (like a real browser).
 *
 * Flow:
 * 1. Check if already logged in (via login page navigation + redirect detection)
 * 2. If not logged in and credentials available: auto-login via Browser-Use
 * 3. If not logged in and no credentials: manual login via VNC
 * 4. Proceed to scraping
 */
async function scrapeWithLogin(
  searchUrl: string,
  platformId: string,
  platform: { name: string; url: string; login_page_url?: string | null },
  credentials: { username: string; password: string } | null,
  useVision: boolean | undefined,
  jobSearchId: number,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
  if (credentials) {
    console.log(`🔐 Credentials found for ${platform.name}`);
  } else {
    console.log(
      `⚠️ No credentials - will require manual login for ${platform.name}`,
    );
  }

  const browserUse = new BrowserUseClient(
    useVision !== undefined ? { useVision } : undefined,
  );

  try {
    let isLoggedIn = false;
    let cloudCdpUrl: string | undefined; // Track CDP URL from cloud mode

    // Phase 1: Check if already logged in
    console.log("\n📌 Phase 1: Checking login state...");

    if (!platform.login_page_url) {
      // No login_page_url configured, assume no login required
      console.log(
        "   No login_page_url configured, assuming no login required",
      );
      console.log(`   Starting browser and navigating to: ${searchUrl}`);

      // Still need to start browser and navigate to search URL
      await browserUse.startSession(searchUrl, CDP_PORT);
      isLoggedIn = true;
    } else {
      // Navigate to login page and check if redirected (indicates logged in)
      const loginCheck = await checkLoginByNavigation(
        browserUse,
        platform.login_page_url,
        jobSearchId,
        CDP_PORT,
      );

      console.log(
        `   Login check result: isLoggedIn=${loginCheck.isLoggedIn}`,
      );

      isLoggedIn = loginCheck.isLoggedIn;
    }

    // Phase 2: Handle login if not already logged in
    if (!isLoggedIn) {
      console.log("\n📌 Phase 2: Login required...");

      if (credentials) {
        // We have credentials - use Browser-Use to auto-fill
        console.log("   Auto-filling credentials...");

        try {
          const loginAttempt = await attemptAutoLogin(
            browserUse,
            platform,
            credentials,
            searchUrl,
            platform.login_page_url || platform.url,
            useVision,
          );
          isLoggedIn = loginAttempt.success;
          cloudCdpUrl = loginAttempt.cdpUrl;
        } catch (error) {
          if (isRecoverableBrowserUseError(error)) {
            console.log(
              `\n⚠️ AI login failed with recoverable error: ${
                error instanceof Error ? error.message : error
              }`,
            );
            console.log("   Falling back to manual login...");

            // Close any existing session before starting fresh
            await browserUse.close();

            // Start browser for manual login
            await browserUse.startSession(
              platform.login_page_url || platform.url,
              CDP_PORT,
            );

            isLoggedIn = await waitForManualIntervention(platform);
          } else {
            throw error;
          }
        }
      } else {
        // No credentials - start browser for manual login
        console.log("   Starting browser for manual login...");

        await browserUse.startSession(
          platform.login_page_url || platform.url,
          CDP_PORT,
        );

        isLoggedIn = await waitForManualIntervention(platform);
      }
    } else {
      console.log("✅ Already logged in, skipping login phase");
    }

    if (!isLoggedIn) {
      throw new Error("Login failed or cancelled");
    }

    // Phase 2: Handoff delay (skip in cloud mode - session is already stable)
    if (!cloudCdpUrl) {
      console.log(
        `\n📌 Phase 2: Handoff delay (${config.handoffDelay}ms)...`,
      );
      await new Promise((resolve) => setTimeout(resolve, config.handoffDelay));
    }

    // Phase 3: Connect Playwright via CDP
    console.log("\n📌 Phase 3: Connecting Playwright via CDP...");

    // Use cloud CDP URL if available, otherwise construct from local host:port
    let cdpUrl: string;
    if (cloudCdpUrl) {
      cdpUrl = cloudCdpUrl;
      console.log(`🌐 Using cloud CDP: ${cdpUrl}`);
    } else {
      // Resolve hostname to IP - Chrome DevTools rejects non-IP Host headers
      const resolvedHost = await resolveCdpHost(CDP_HOST);
      cdpUrl = `http://${resolvedHost}:${CDP_PORT}`;
      console.log(`🖥️ Using local CDP: ${cdpUrl}`);
    }
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
    console.log(`📄 Current page: ${page.url()}`);

    // Always navigate to search URL to ensure we're on the correct site
    console.log(`🔄 Navigating to search results: ${searchUrl}`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Phase 4: Playwright extraction
    console.log("\n📌 Phase 4: Job extraction...");

    const result = await scrapeJobsWithClicks(
      jobSearchId,
      page,
      searchUrl,
      platformId,
    );

    console.log(
      `\n✅ Scraping complete: ${result.jobsProcessed} jobs processed`,
    );

    // Disconnect Playwright (don't close browser - we'll do that via API)
    await browser.close();

    return result;
  } finally {
    // Always close the browser session
    console.log("\n🧹 Closing browser session...");
    await browserUse.close();
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
        return waitForManualIntervention(platform);
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
  platform: Platform,
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
 * @param jobSearchId Job search ID (required for profile lookup and logging)
 * @param useVision Whether to enable visual mode (screenshots) for LLM (for login)
 * @returns Object with jobsProcessed count and strippedHtml from search page
 */
export async function scrapeJobs(
  searchUrl: string,
  platformId: string,
  jobSearchId: number,
  useVision?: boolean,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
  console.log(`\n🔍 Starting job scraper (with persistent sessions)...`);

  // Get platform information
  const platform = await dbDirect.job_platforms.findUnique({
    where: { id: Number(platformId) },
  });

  if (!platform) {
    throw new Error(`Platform with ID ${platformId} not found`);
  }

  // Look up job search to get the profile for credentials
  const jobSearch = await dbDirect.job_searches.findUnique({
    where: { id: jobSearchId },
    select: { profile: true },
  });

  if (!jobSearch) {
    throw new Error(`Job search ${jobSearchId} not found`);
  }

  // Check if we have credentials for auto-fill
  let credentials: { username: string; password: string } | null = null;

  if (jobSearch.profile) {
    const creds = await getPlatformCredentials(
      jobSearch.profile,
      Number(platformId),
    );
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
    useVision,
    jobSearchId,
  );
}
