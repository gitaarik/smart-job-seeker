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
import { promises as dns } from "dns";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser/use-client";
import { scrapeJobsWithClicks } from "./extraction";
import { interpolatePrompt } from "$lib/server/ai-chat/utils";
import { dbDirect } from "$lib/db";
import { getPlatformCredentials } from "../auth/platform";
import { promptUser } from "./utils";
import type { Platform, PlatformCredentials } from "./types";

// ============================================================================
// Response Types for Browser-Use Tasks
// ============================================================================

/** Response from browser_use_login task */
interface LoginTaskResult {
  logged_in: boolean;
  ready: boolean;
  captcha_needed: boolean;
  verification_needed: boolean;
  verification_type: "email" | "sms" | "2fa" | null;
  current_url: string;
  reason: string;
}

/** Response from browser_use_navigate_search task */
interface NavigateSearchResult {
  ready: boolean;
  captcha_needed: boolean;
  redirected_to_login: boolean;
  current_url: string;
  reason: string;
}

/** Response from browser_use_prepare_session task */
interface PrepareSessionResult {
  ready: boolean;
  logged_in: boolean;
  captcha_needed: boolean;
  verification_needed: boolean;
  verification_type: "email" | "sms" | "2fa" | null;
  current_url: string;
  reason: string;
}

/** Type of manual intervention needed */
type InterventionType = "captcha" | "verification" | "login";

/** Intervention URL type */
type InterventionUrlType = "vnc" | "live_url";

const CDP_HOST = config.cdpHost;
const CDP_PORT = config.cdpPort;

// ============================================================================
// Text Pattern Parsing Helpers
// ============================================================================

/**
 * Detect verification type from text.
 */
function detectVerificationType(text: string): "email" | "sms" | "2fa" | null {
  const lower = text.toLowerCase();
  if (/email.*(code|verification)|verification.*email/i.test(lower)) {
    return "email";
  }
  if (/sms|text message|phone.*code/i.test(lower)) return "sms";
  if (/2fa|two-factor|authenticator|otp/i.test(lower)) return "2fa";
  if (/verification.*code|code.*verification/i.test(lower)) return "email"; // default to email
  return null;
}

/**
 * Extract URL from text.
 */
function extractUrlFromText(text: string): string {
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  return urlMatch ? urlMatch[0] : "";
}

/**
 * Parse login task result from agent output text.
 */
function parseLoginTaskResult(agentOutput: string): LoginTaskResult {
  // Match CAPTCHA indicators - but not "cloudflare" alone (auto-verification is not CAPTCHA)
  // The prompt now tells the agent to say "interactive challenge requires user action"
  const captcha =
    /captcha|interactive challenge|verify you are human|i am not a robot/i
      .test(agentOutput);
  const verification =
    /verification.*(code|needed)|2fa|two-factor|enter.*code|authenticator/i
      .test(
        agentOutput,
      );
  const loggedIn = !captcha &&
    !verification &&
    /logged in|login successful|successfully (logged|authenticated)|dashboard|authenticated/i
      .test(
        agentOutput,
      );

  return {
    logged_in: loggedIn,
    ready: loggedIn && /job|search|listing|feed/i.test(agentOutput),
    captcha_needed: captcha,
    verification_needed: verification,
    verification_type: verification
      ? detectVerificationType(agentOutput)
      : null,
    current_url: extractUrlFromText(agentOutput),
    reason: agentOutput.slice(0, 300),
  };
}

/**
 * Parse navigate search result from agent output text.
 */
function parseNavigateSearchResult(agentOutput: string): NavigateSearchResult {
  // Match CAPTCHA indicators - but not "cloudflare" alone (auto-verification is not CAPTCHA)
  const captcha =
    /captcha|interactive challenge|verify you are human|i am not a robot/i
      .test(agentOutput);
  const redirectedToLogin = /redirected.*login|login.*page|sign.?in.*form/i
    .test(agentOutput);
  const ready = !captcha &&
    !redirectedToLogin &&
    /job|search|listing|results|ready/i.test(agentOutput);

  return {
    ready,
    captcha_needed: captcha,
    redirected_to_login: redirectedToLogin,
    current_url: extractUrlFromText(agentOutput),
    reason: agentOutput.slice(0, 300),
  };
}

/**
 * Parse prepare session result from agent output text.
 */
function parsePrepareSessionResult(
  agentOutput: string,
): PrepareSessionResult {
  // Match CAPTCHA indicators - but not "cloudflare" alone (auto-verification is not CAPTCHA)
  const captcha =
    /captcha|interactive challenge|verify you are human|i am not a robot/i
      .test(agentOutput);
  const verification =
    /verification.*(code|needed)|2fa|two-factor|enter.*code|authenticator/i
      .test(
        agentOutput,
      );
  const loggedIn = !captcha &&
    !verification &&
    /logged in|login successful|successfully (logged|authenticated)|dashboard|authenticated/i
      .test(
        agentOutput,
      );
  const ready = loggedIn && /job|search|listing|feed|ready/i.test(agentOutput);

  return {
    ready,
    logged_in: loggedIn,
    captcha_needed: captcha,
    verification_needed: verification,
    verification_type: verification
      ? detectVerificationType(agentOutput)
      : null,
    current_url: extractUrlFromText(agentOutput),
    reason: agentOutput.slice(0, 300),
  };
}

// ============================================================================
// Manual Intervention Handler (DRY for VNC and Live URL)
// ============================================================================

/**
 * Wait for user to complete manual intervention (CAPTCHA, 2FA, or login).
 * Supports both local mode (VNC) and cloud mode (Live URL).
 *
 * @param platform Platform information for display
 * @param interventionType Type of intervention needed
 * @param urlType VNC for local mode, live_url for cloud mode
 * @param interventionUrl The URL to display (VNC URL or Live URL)
 * @returns true if user confirms completion, false if cancelled
 */
async function waitForManualIntervention(
  platform: Platform,
  interventionType: InterventionType,
  urlType: InterventionUrlType,
  interventionUrl: string,
): Promise<boolean> {
  const typeLabels: Record<InterventionType, string> = {
    captcha: "CAPTCHA",
    verification: "2FA Verification",
    login: "Manual Login",
  };

  const urlTypeLabels: Record<InterventionUrlType, string> = {
    vnc: "VNC",
    live_url: "Browser-Use Cloud Live URL",
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `🔐 ${typeLabels[interventionType]} Required for ${platform.name}`,
  );
  console.log(`${"=".repeat(60)}`);
  console.log(
    `\nPlease complete the ${
      typeLabels[interventionType].toLowerCase()
    } manually:`,
  );
  console.log(`  - ${urlTypeLabels[urlType]}: ${interventionUrl}`);

  if (urlType === "vnc") {
    console.log(`  - Connect with a VNC viewer to complete the task`);
  } else {
    console.log(`  - Open the URL in your browser to see the session`);
  }

  let confirm = "";
  while (confirm !== "c" && confirm !== "q") {
    confirm = (
      await promptUser(
        "\nWhen done, enter 'c' to continue or 'q' to quit: ",
      )
    ).toLowerCase();
  }

  if (confirm === "q") {
    console.log("❌ Manual intervention cancelled by user");
    return false;
  }

  console.log("✅ Continuing after manual intervention...");
  return true;
}

/**
 * Get the intervention URL based on mode.
 * Returns VNC URL for local mode, Live URL for cloud mode.
 */
function getInterventionInfo(
  browserUse: BrowserUseClient,
): { urlType: InterventionUrlType; url: string } {
  if (browserUse.isCloudMode && browserUse.liveUrl) {
    return { urlType: "live_url", url: browserUse.liveUrl };
  }
  return { urlType: "vnc", url: "localhost:5900" };
}

// ============================================================================
// Prompt Building Helpers
// ============================================================================

/**
 * Build login task prompt (browser_use_login).
 */
async function buildLoginTaskPrompt(
  loginUrl: string,
  credentials: PlatformCredentials,
): Promise<string> {
  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "browser_use_login" },
  });

  if (!promptTemplate?.user_prompt) {
    throw new Error("Prompt 'browser_use_login' not found in database");
  }

  return interpolatePrompt(promptTemplate.user_prompt, {
    loginUrl,
    username: credentials.username,
    password: credentials.password,
  });
}

/**
 * Build navigate search task prompt (browser_use_navigate_search).
 */
async function buildNavigateSearchPrompt(searchUrl: string): Promise<string> {
  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "browser_use_navigate_search" },
  });

  if (!promptTemplate?.user_prompt) {
    throw new Error(
      "Prompt 'browser_use_navigate_search' not found in database",
    );
  }

  return interpolatePrompt(promptTemplate.user_prompt, {
    searchUrl,
  });
}

/**
 * Build prepare session task prompt (browser_use_prepare_session).
 */
async function buildPrepareSessionPrompt(
  startUrl: string,
  searchUrl: string,
  credentials: PlatformCredentials | null,
): Promise<string> {
  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "browser_use_prepare_session" },
  });

  if (!promptTemplate?.user_prompt) {
    throw new Error(
      "Prompt 'browser_use_prepare_session' not found in database",
    );
  }

  return interpolatePrompt(promptTemplate.user_prompt, {
    startUrl,
    searchUrl,
    username: credentials?.username || "(no credentials)",
    password: credentials?.password || "",
  });
}

// ============================================================================
// Error Recovery
// ============================================================================

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

// ============================================================================
// Two-Phase Login Flow (when login_page_url configured)
// ============================================================================

/**
 * Execute Phase A: Login using browser_use_login prompt.
 * Returns whether login succeeded and if intervention is needed.
 */
async function executeLoginPhase(
  browserUse: BrowserUseClient,
  platform: Platform,
  credentials: PlatformCredentials,
  useVision: boolean,
): Promise<LoginTaskResult | null> {
  const loginUrl = platform.login_page_url!;
  console.log(`\n📌 Phase A: Login to ${platform.name}...`);
  console.log(`   Login URL: ${loginUrl}`);

  const loginTask = await buildLoginTaskPrompt(loginUrl, credentials);
  console.log("   Running login task...");

  const result = await browserUse.executeTask({
    task: loginTask,
    cdpPort: CDP_PORT,
    useVision,
  });

  console.log(
    `   Task completed, agent output: ${
      result.agent_output?.substring(0, 200)
    }...`,
  );

  const parsed = parseLoginTaskResult(result.agent_output || "");
  if (parsed) {
    console.log(
      `   Result: logged_in=${parsed.logged_in}, captcha_needed=${parsed.captcha_needed}`,
    );
    console.log(`   Reason: ${parsed.reason}`);
  }

  return parsed;
}

/**
 * Execute Phase B: Navigate to search page using browser_use_navigate_search prompt.
 * Returns whether search page is ready.
 */
async function executeNavigateSearchPhase(
  browserUse: BrowserUseClient,
  searchUrl: string,
  useVision: boolean,
): Promise<NavigateSearchResult | null> {
  console.log(`\n📌 Phase B: Navigate to search page...`);
  console.log(`   Search URL: ${searchUrl}`);

  const navigateTask = await buildNavigateSearchPrompt(searchUrl);
  console.log("   Running navigate task...");

  const result = await browserUse.executeTask({
    task: navigateTask,
    cdpPort: CDP_PORT,
    useVision,
  });

  console.log(
    `   Task completed, agent output: ${
      result.agent_output?.substring(0, 200)
    }...`,
  );

  const parsed = parseNavigateSearchResult(result.agent_output || "");
  if (parsed) {
    console.log(
      `   Result: ready=${parsed.ready}, captcha_needed=${parsed.captcha_needed}`,
    );
    console.log(`   Reason: ${parsed.reason}`);
  }

  return parsed;
}

// ============================================================================
// Single-Task Flow (when no login_page_url)
// ============================================================================

/**
 * Execute merged flow using browser_use_prepare_session prompt.
 * Handles login detection, optional login, and navigation in one task.
 */
async function executePrepareSessionPhase(
  browserUse: BrowserUseClient,
  startUrl: string,
  searchUrl: string,
  credentials: PlatformCredentials | null,
  useVision: boolean,
): Promise<PrepareSessionResult | null> {
  console.log(`\n📌 Prepare Session: Login (if needed) and navigate...`);
  console.log(`   Start URL: ${startUrl}`);
  console.log(`   Search URL: ${searchUrl}`);

  const prepareTask = await buildPrepareSessionPrompt(
    startUrl,
    searchUrl,
    credentials,
  );
  console.log("   Running prepare session task...");

  const result = await browserUse.executeTask({
    task: prepareTask,
    cdpPort: CDP_PORT,
    useVision,
  });

  console.log(
    `   Task completed, agent output: ${
      result.agent_output?.substring(0, 200)
    }...`,
  );

  const parsed = parsePrepareSessionResult(result.agent_output || "");
  if (parsed) {
    console.log(
      `   Result: ready=${parsed.ready}, logged_in=${parsed.logged_in}, captcha_needed=${parsed.captcha_needed}`,
    );
    console.log(`   Reason: ${parsed.reason}`);
  }

  return parsed;
}

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
