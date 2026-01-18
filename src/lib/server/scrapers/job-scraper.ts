/**
 * Unified Job Scraper
 *
 * Single entry point for all job scraping:
 * - With credentials: Browser-Use login → Patchright extraction via CDP
 * - Without credentials: Patchright direct browser → extraction
 */

import { chromium } from "patchright";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser-use-client";
import { scrapeJobsWithClicks } from "./click-scraper";
import { interpolatePrompt } from "$lib/server/ai-chat-utils";
import { dbDirect } from "$lib/db";
import { launchBrowser } from "../browser-utils";
import { getPlatformCredentials } from "../platform-auth";

const CDP_PORT = 9222;

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

  return `You are a browser automation assistant. Your task is to log into a website and navigate to a job search results page. Do NOT extract any job data - just perform the login and navigation.

1. Navigate to ${platform.login_page_url || platform.url}
2. Log in using:
   - Email/Username: ${credentials.username}
   - Password: ${credentials.password}
3. After login, navigate to the job search results at: ${searchUrl}
4. Once you see job listings on the page, report SUCCESS.

IMPORTANT:
- If you encounter a CAPTCHA, report it and stop.
- If login fails, report the error and stop.
- Do NOT click on any individual job listings.
- Do NOT extract job data.
- Your only goal is to get to the search results page while logged in.

Report your final status as either:
- SUCCESS: Currently viewing job search results at [URL]
- FAILED: [reason]`;
}

/**
 * Scrape jobs with Browser-Use login + Patchright extraction
 * Used when credentials are available
 */
async function scrapeWithLogin(
  searchUrl: string,
  platformId: string,
  platform: { name: string; url: string; login_page_url?: string | null },
  credentials: { username: string; password: string },
  sendScreenshots?: boolean,
): Promise<number> {
  console.log(`🔐 Credentials found for ${platform.name}`);

  const browserUse = new BrowserUseClient(
    sendScreenshots !== undefined ? { sendScreenshots } : undefined,
  );

  try {
    // Phase 1: Browser-Use launches Chrome with CDP and performs login
    console.log("\n📌 Phase 1: Browser-Use login...");

    const loginTask = await buildLoginPrompt(platform, credentials, searchUrl);

    console.log("📝 Login task preview:");
    console.log(loginTask.substring(0, 300) + "...");

    const loginResult = await browserUse.startHybridSession({
      task: loginTask,
      startUrl: platform.login_page_url || platform.url,
      cdpPort: CDP_PORT,
      maxTime: config.hybridLoginTimeout / 1000, // Convert ms to seconds
      sendScreenshots,
    });

    if (!loginResult.login_success) {
      throw new Error(
        `Login failed: ${loginResult.error || "Unknown error"}`,
      );
    }

    console.log(`✅ Login successful! Current URL: ${loginResult.current_url}`);
    console.log(`   CDP available at localhost:${loginResult.cdp_port}`);

    // Phase 2: Handoff delay
    console.log(
      `\n📌 Phase 2: Handoff delay (${config.hybridHandoffDelay}ms)...`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, config.hybridHandoffDelay)
    );

    // Phase 3: Connect Patchright via CDP
    console.log("\n📌 Phase 3: Connecting Patchright via CDP...");

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

    // Phase 4: Patchright extraction
    console.log("\n📌 Phase 4: Job extraction...");

    const result = await scrapeJobsWithClicks(
      page,
      searchUrl,
      platformId,
      undefined, // Don't pass profileId - already logged in
    );

    console.log(
      `\n✅ Scraping complete: ${result.jobsProcessed} jobs processed`,
    );

    // Disconnect Patchright (don't close browser - we'll do that via API)
    await browser.close();

    return result.jobsProcessed;
  } finally {
    // Always close the hybrid session
    console.log("\n🧹 Closing browser session...");
    await browserUse.closeHybridSession();
  }
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
 * Unified entry point that handles both authenticated and unauthenticated scraping:
 * - With credentials: Uses Browser-Use for login, then Patchright for extraction
 * - Without credentials: Uses Patchright directly
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
  console.log(`\n🔍 Starting job scraper...`);

  // Get platform information
  const platform = await dbDirect.job_platforms.findUnique({
    where: { id: Number(platformId) },
  });

  if (!platform) {
    throw new Error(`Platform with ID ${platformId} not found`);
  }

  // Check if we have credentials for login
  let credentials: { username: string; password: string } | null = null;

  if (profileId) {
    const creds = await getPlatformCredentials(profileId, Number(platformId));
    if (creds?.username && creds?.password) {
      credentials = { username: creds.username, password: creds.password };
    }
  }

  if (credentials) {
    // Full flow: Browser-Use login + Patchright extraction
    return scrapeWithLogin(
      searchUrl,
      platformId,
      platform,
      credentials,
      sendScreenshots,
    );
  } else {
    // Simple flow: Just launch Patchright directly (no login)
    if (profileId) {
      console.warn("⚠️ No credentials found, scraping without login");
    }
    return scrapeWithoutLogin(searchUrl, platformId, profileId);
  }
}
