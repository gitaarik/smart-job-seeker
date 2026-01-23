/**
 * Unified Job Scraper
 *
 * Single entry point for all job scraping with two-phase flow architecture:
 *
 * Flow A (when login_page_url configured):
 *   Phase 1: browser_use_login - Navigate to login page, enter credentials
 *   Phase 2: browser_use_navigate_search - Navigate to search page, check CAPTCHA
 *
 * Flow B (when no login_page_url):
 *   Single task: browser_use_prepare_session - Handles login detection + navigation
 *
 * Both flows support:
 * - Local mode: VNC for manual intervention
 * - Cloud mode: Live URL for manual intervention
 * - Retry loops after CAPTCHA/2FA manual solving
 */

import { chromium } from "playwright";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser/use-client";
import { scrapeJobsWithClicks } from "./extraction";
import { dbDirect } from "$lib/db";
import { getPlatformCredentials } from "../auth/platform";
import { resolveCdpHost } from "./utils";
import type { Platform, PlatformCredentials } from "./types";
import {
  executeLoginPhase,
  executeNavigateSearchPhase,
  executePrepareSessionPhase,
  getInterventionInfo,
  waitForManualIntervention,
} from "./browser-use";

const CDP_HOST = config.cdpHost;
const CDP_PORT = config.cdpPort;

// ============================================================================
// Main Scraper Function
// ============================================================================

/**
 * Scrape jobs with two-flow architecture.
 *
 * Flow A (when login_page_url configured):
 *   Phase 1: browser_use_login - Navigate to login page, enter credentials
 *   Phase 2: browser_use_navigate_search - Navigate to search page
 *
 * Flow B (when no login_page_url):
 *   Single task: browser_use_prepare_session - Combined login detection + navigation
 *
 * Both flows include retry loops for manual intervention (CAPTCHA, 2FA).
 */
async function scrapeWithLogin(
  searchUrl: string,
  platformId: string,
  platform: Platform,
  credentials: PlatformCredentials | null,
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

  const visionEnabled = useVision ?? true;

  try {
    let cloudCdpUrl: string | undefined;
    let sessionReady = false;

    // Start browser session
    console.log("\n📌 Starting browser session...");

    if (browserUse.isCloudMode) {
      // Cloud mode: Create a cloud session
      const cloudSession = await browserUse.startCloudSession();
      cloudCdpUrl = cloudSession.cdp_url;
      console.log(`🌐 Cloud mode: Live URL: ${cloudSession.live_url}`);
    } else {
      // Local mode: Start local browser
      const startUrl = platform.login_page_url || searchUrl;
      await browserUse.startSession(startUrl, CDP_PORT);
      console.log(`🖥️ Local mode: VNC at localhost:5900`);
    }

    // Determine which flow to use
    const hasLoginPageUrl = !!platform.login_page_url;

    if (hasLoginPageUrl && credentials) {
      // ========================================
      // FLOW A: Two-phase flow with login_page_url
      // ========================================
      console.log("\n🔄 Using Flow A: Two-phase login flow");

      // Retry loop for Phase A (Login)
      let loginRetries = 0;
      const maxRetries = 3;

      while (!sessionReady && loginRetries < maxRetries) {
        loginRetries++;
        console.log(`\n--- Login attempt ${loginRetries}/${maxRetries} ---`);

        // Phase A: Login
        const loginResult = await executeLoginPhase(
          browserUse,
          platform,
          credentials,
          visionEnabled,
        );

        if (!loginResult) {
          console.log("⚠️ Could not parse login result, retrying...");
          continue;
        }

        // Handle login result
        if (loginResult.captcha_needed) {
          const { urlType, url } = getInterventionInfo(browserUse);
          const continued = await waitForManualIntervention(
            platform,
            "captcha",
            urlType,
            url,
          );
          if (!continued) throw new Error("Login cancelled by user");
          continue; // Retry the login phase
        }

        if (loginResult.verification_needed) {
          const { urlType, url } = getInterventionInfo(browserUse);
          const continued = await waitForManualIntervention(
            platform,
            "verification",
            urlType,
            url,
          );
          if (!continued) throw new Error("Verification cancelled by user");
          continue; // Retry the login phase
        }

        if (!loginResult.logged_in) {
          console.log(`⚠️ Login failed: ${loginResult.reason}`);
          const { urlType, url } = getInterventionInfo(browserUse);
          const continued = await waitForManualIntervention(
            platform,
            "login",
            urlType,
            url,
          );
          if (!continued) throw new Error("Login cancelled by user");
          continue; // Retry the login phase
        }

        console.log("✅ Login successful!");

        // Phase B: Navigate to search page (also with retry loop)
        let searchRetries = 0;
        while (!sessionReady && searchRetries < maxRetries) {
          searchRetries++;
          console.log(
            `\n--- Search navigation attempt ${searchRetries}/${maxRetries} ---`,
          );

          const searchResult = await executeNavigateSearchPhase(
            browserUse,
            searchUrl,
            visionEnabled,
          );

          if (!searchResult) {
            console.log("⚠️ Could not parse search result, retrying...");
            continue;
          }

          if (searchResult.captcha_needed) {
            const { urlType, url } = getInterventionInfo(browserUse);
            const continued = await waitForManualIntervention(
              platform,
              "captcha",
              urlType,
              url,
            );
            if (!continued) throw new Error("CAPTCHA cancelled by user");
            continue; // Retry navigation
          }

          if (searchResult.redirected_to_login) {
            console.log("⚠️ Redirected to login - session may have expired");
            break; // Go back to login phase
          }

          if (searchResult.ready) {
            console.log("✅ Search page ready!");
            sessionReady = true;
          }
        }
      }
    } else {
      // ========================================
      // FLOW B: Single-task flow (no login_page_url)
      // ========================================
      console.log("\n🔄 Using Flow B: Single-task prepare session flow");

      const startUrl = platform.login_page_url || searchUrl;
      let retries = 0;
      const maxRetries = 3;

      while (!sessionReady && retries < maxRetries) {
        retries++;
        console.log(
          `\n--- Prepare session attempt ${retries}/${maxRetries} ---`,
        );

        const result = await executePrepareSessionPhase(
          browserUse,
          startUrl,
          searchUrl,
          credentials,
          visionEnabled,
        );

        if (!result) {
          console.log("⚠️ Could not parse prepare result, retrying...");
          continue;
        }

        // Handle various states
        if (result.captcha_needed) {
          const { urlType, url } = getInterventionInfo(browserUse);
          const continued = await waitForManualIntervention(
            platform,
            "captcha",
            urlType,
            url,
          );
          if (!continued) throw new Error("CAPTCHA cancelled by user");
          continue; // Retry
        }

        if (result.verification_needed) {
          const { urlType, url } = getInterventionInfo(browserUse);
          const continued = await waitForManualIntervention(
            platform,
            "verification",
            urlType,
            url,
          );
          if (!continued) throw new Error("Verification cancelled by user");
          continue; // Retry
        }

        if (!result.logged_in && credentials) {
          console.log(`⚠️ Login failed: ${result.reason}`);
          const { urlType, url } = getInterventionInfo(browserUse);
          const continued = await waitForManualIntervention(
            platform,
            "login",
            urlType,
            url,
          );
          if (!continued) throw new Error("Login cancelled by user");
          continue; // Retry
        }

        if (!result.logged_in && !credentials) {
          // No credentials provided, need manual login
          const { urlType, url } = getInterventionInfo(browserUse);
          const continued = await waitForManualIntervention(
            platform,
            "login",
            urlType,
            url,
          );
          if (!continued) throw new Error("Login cancelled by user");
          continue; // Retry
        }

        if (result.ready) {
          console.log("✅ Session ready for scraping!");
          sessionReady = true;
        }
      }
    }

    if (!sessionReady) {
      throw new Error("Failed to prepare session after multiple retries");
    }

    // Handoff delay (skip in cloud mode)
    if (!cloudCdpUrl) {
      console.log(`\n📌 Handoff delay (${config.handoffDelay}ms)...`);
      await new Promise((resolve) => setTimeout(resolve, config.handoffDelay));
    }

    // Connect Playwright via CDP
    console.log("\n📌 Connecting Playwright via CDP...");

    let cdpUrl: string;
    if (cloudCdpUrl) {
      cdpUrl = cloudCdpUrl;
      console.log(`🌐 Using cloud CDP: ${cdpUrl}`);
    } else {
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

    // Browser-Use should have cleaned up extra tabs, leaving only the active one
    // Find the page matching the search URL hostname, or use the first non-blank page
    const searchHostname = new URL(searchUrl).hostname;
    let page = pages.find((p) => p.url().includes(searchHostname));

    if (!page) {
      // Fallback: find any page that's not blank
      page = pages.find((p) => !p.url().startsWith("about:"));
    }

    if (!page) {
      // Last resort: use first page
      page = pages[0];
    }

    console.log(`📄 Found ${pages.length} page(s), using: ${page.url()}`);

    // Close any other tabs (shouldn't happen if Python cleanup worked)
    for (const p of pages) {
      if (p !== page) {
        console.log(`🧹 Closing stale tab: ${p.url()}`);
        await p.close();
      }
    }

    // Navigate to search URL if not already there
    if (!page.url().includes(new URL(searchUrl).pathname)) {
      console.log(`🔄 Navigating to search results: ${searchUrl}`);
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }

    // Job extraction
    console.log("\n📌 Job extraction...");

    const result = await scrapeJobsWithClicks(
      jobSearchId,
      page,
      searchUrl,
      platformId,
    );

    console.log(
      `\n✅ Scraping complete: ${result.jobsProcessed} jobs processed`,
    );

    await browser.close();
    return result;
  } finally {
    console.log("\n🧹 Closing browser session...");
    await browserUse.close();
  }
}

// ============================================================================
// Public Entry Point
// ============================================================================

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
