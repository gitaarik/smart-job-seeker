#!/usr/bin/env node

/**
 * Job site scraping script
 * Uses Playwright to scrape job listings and LLM to extract data
 */

import { type BrowserContext, type Page } from "playwright";
import { launchBrowser } from "$lib/server/browser-utils";
import { dbDirect } from "$lib/db";
import {
  detectLoginPage,
  extractJobData,
  extractJobLinks,
  getPlatformIdFromUrl,
  upsertJob,
} from "$lib/server/job-scraper";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getSiteConfig, getSiteName } from "$lib/server/job-site-configs";
import { config } from "$lib/server/config";

const execAsync = promisify(exec);

interface SearchAction {
  id: number;
  name: string;
  search_url: string | null;
  navigation_type: "url" | "click" | null;
  platform: number | null;
  job_platforms: {
    navigation_type: "url" | "click" | null;
  } | null;
}

// CLI Program
const program = new Command();

program
  .name("scrape-jobs")
  .description(
    "Scrape job postings from active job searches or re-scrape a specific job",
  )
  .version("1.0.0")
  .option("-j, --job-id <id>", "Re-scrape a specific job by ID", parseInt)
  .option(
    "-s, --search-id <id>",
    "Scrape only a specific job search by ID",
    parseInt,
  )
  .option(
    "-f, --force",
    "Force re-import even if HTML hasn't changed (useful for testing new prompts)",
  )
  .helpOption("-h, --help", "Display help for command");

program.parse();
const options = program.opts();

/**
 * Normalize URL by removing query parameters and fragments
 */
function normalizeJobUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Save debug screenshot if debug mode is enabled
 */
async function saveDebugScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  if (!config.scraperSaveDebugScreenshots) {
    return;
  }

  try {
    const screenshotDir = join(process.cwd(), "debug-screenshots");
    if (!existsSync(screenshotDir)) {
      mkdirSync(screenshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${name}-${timestamp}.png`;
    const filepath = join(screenshotDir, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Debug screenshot saved: ${filepath}`);
  } catch (error) {
    console.warn(
      "⚠️  Failed to save debug screenshot:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Check if job's HTML has changed compared to database
 * @param sourceUrl URL of the job posting
 * @param newStrippedHtml New stripped HTML to compare
 * @param force If true, always return true (force re-import)
 * @returns true if HTML is different or job doesn't exist, false if unchanged
 */
async function hasHtmlChanged(
  sourceUrl: string,
  newStrippedHtml: string,
  force = false,
): Promise<boolean> {
  // If force flag is set, always consider HTML as changed
  if (force) {
    return true;
  }

  const normalizedUrl = normalizeJobUrl(sourceUrl);

  const existingJob = await dbDirect.jobs.findFirst({
    where: { source_url: normalizedUrl },
    select: { id: true, source_html_stripped: true },
  });

  // If job doesn't exist, HTML is "new"
  if (!existingJob) {
    return true;
  }

  // If no existing HTML stored, consider it changed
  if (!existingJob.source_html_stripped) {
    return true;
  }

  // Compare HTML content
  return existingJob.source_html_stripped !== newStrippedHtml;
}

/**
 * Check if current page is a login page using LLM
 */
async function isLoginPage(page: Page): Promise<boolean> {
  try {
    const html = await page.content();
    return await detectLoginPage(html);
  } catch (error) {
    console.error(
      "⚠️  Failed to detect login page:",
      error instanceof Error ? error.message : String(error),
    );
    // Fallback to false to continue (don't block on detection errors)
    return false;
  }
}

/**
 * Wait for user to manually log in (max 2 minutes)
 */
async function waitForManualLogin(page: Page): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  LinkedIn Login Required");
  console.log("=".repeat(60));
  console.log("Please log into LinkedIn in the browser window.");
  console.log("You have 2 minutes to complete the login.");
  console.log("=".repeat(60) + "\n");

  const timeoutMs = 2 * 60 * 1000; // 2 minutes
  const startTime = Date.now();
  const checkInterval = 5000; // Check every 5 seconds

  // Wait for user to log in (check every 5 seconds, max 2 minutes)
  while (Date.now() - startTime < timeoutMs) {
    const remainingSeconds = Math.floor(
      (timeoutMs - (Date.now() - startTime)) / 1000,
    );
    console.log(`⏱️  Waiting for login... (${remainingSeconds}s remaining)`);

    if (!(await isLoginPage(page))) {
      console.log("✅ Login detected! Continuing...\n");
      // Wait for page to fully load
      await page.waitForTimeout(2000);
      return true;
    }

    await page.waitForTimeout(checkInterval);
  }

  console.log("❌ Login timeout (2 minutes elapsed)");
  return false;
}

/**
 * Scrape jobs using URL-based navigation (traditional)
 * Extracts job URLs from search results and navigates to each
 * @returns Array of job URLs
 */
async function scrapeJobsWithUrls(
  page: Page,
  searchUrl: string,
): Promise<string[]> {
  console.log("\n🔗 Starting URL-based scraping (traditional navigation)");

  const html = await page.content();
  const htmlSize = (html.length / 1024).toFixed(1);

  console.log(`📄 Extracting job links from HTML (${htmlSize} KB)...`);
  let jobUrls = await extractJobLinks(html);

  if (!jobUrls || jobUrls.length === 0) {
    console.log("⚠️  No job links found.");

    // Run inline diagnostics with Playwright
    const hasLoginForm = await page.locator('form[action*="login"]')
      .isVisible().catch(() => false);
    const hasCaptcha = await page.locator('iframe[src*="captcha"]')
      .isVisible().catch(() => false);

    if (hasLoginForm) {
      console.log("   Reason: Login page detected");
      console.log(
        "   Action: Run script again and complete login when prompted",
      );
    } else if (hasCaptcha) {
      console.log("   Reason: CAPTCHA challenge detected");
      console.log(
        "   Action: Wait and try again later, or solve CAPTCHA manually",
      );
    } else {
      console.log("   Possible reasons:");
      console.log("   - Search returned no results (legitimate)");
      console.log("   - Page structure changed (update selectors)");
      console.log("   - Content still loading (increase timeout)");
    }

    return [];
  }

  // Convert relative URLs to absolute URLs
  const baseUrl = new URL(searchUrl);
  jobUrls = jobUrls.map((url) => {
    if (url.startsWith("/")) {
      return `${baseUrl.origin}${url}`;
    }
    return url;
  });

  console.log(`Found ${jobUrls.length} job link(s)`);
  return jobUrls;
}

/**
 * Scrape jobs using click-based navigation (SPAs)
 * Marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 * @returns Array of job HTML content
 */
async function scrapeJobsWithClicks(
  page: Page,
  siteConfig: ReturnType<typeof getSiteConfig>,
  searchUrl: string,
): Promise<string[]> {
  console.log("\n🔄 Starting SPA scraping mode (click-based navigation)");

  // Import CDP utilities dynamically
  const { markClickableElementsInContainer } = await import(
    "$lib/server/cdp-utils"
  );
  const { extractJobClickSelectors } = await import("$lib/server/job-scraper");

  // Mark all clickable elements using CDP
  console.log("📍 Step 1/3: Detecting click handlers via CDP...");
  const container = siteConfig.selectors.jobListContainer || "body";
  console.log(`   Scanning container: ${container}`);
  const startCdp = Date.now();

  const clickableCount = await markClickableElementsInContainer(
    page,
    container,
  );

  const cdpDuration = ((Date.now() - startCdp) / 1000).toFixed(2);
  console.log(
    `   ✓ Found ${clickableCount} elements with click listeners (${cdpDuration}s)`,
  );

  if (clickableCount === 0) {
    console.log("   ⚠️  No clickable elements found - page may not be loaded");
    return [];
  }

  // Get marked HTML
  const markedHtml = await page.content();
  const htmlSize = (markedHtml.length / 1024).toFixed(1);
  console.log(`   HTML size: ${htmlSize} KB`);

  // Check if we have job-detail-button markers (high-confidence job buttons)
  const jobDetailButtonMatches = markedHtml.matchAll(
    /data-clickable-id="(\d+)" data-click-text="job-detail-button"/g,
  );
  const jobDetailButtonIds = Array.from(jobDetailButtonMatches).map((match) =>
    parseInt(match[1])
  );

  let clickableIds: number[];
  let pattern: string;
  let jobCount: number;

  if (jobDetailButtonIds.length > 0) {
    // We found job-detail buttons - use them directly without LLM validation
    console.log("\n✓ Step 2/3: Using detected job-detail buttons...");
    clickableIds = jobDetailButtonIds;
    pattern = "job-detail buttons detected by CDP";
    jobCount = jobDetailButtonIds.length;
    console.log(
      `   Found ${jobCount} job-detail buttons: [${clickableIds.join(", ")}]`,
    );
  } else {
    // No job-detail buttons found - fall back to LLM analysis
    console.log("\n🤖 Step 2/3: Asking LLM to identify job card pattern...");
    const startLlm = Date.now();

    const result = await extractJobClickSelectors(markedHtml);
    clickableIds = result.clickableIds;
    pattern = result.pattern;
    jobCount = result.jobCount;

    const llmDuration = ((Date.now() - startLlm) / 1000).toFixed(2);
    console.log(`   ✓ LLM analysis complete (${llmDuration}s)`);
    console.log(`   Pattern: ${pattern}`);
    console.log(`   Job cards found: ${jobCount}`);
    console.log(`   Clickable IDs: [${clickableIds.join(", ")}]`);
  }

  if (clickableIds.length === 0) {
    console.log("   ⚠️  No job cards found in the page");
    return [];
  }

  const jobHtmlList: string[] = [];

  // Click each identified job card
  console.log(
    `\n👆 Step 3/3: Clicking through ${clickableIds.length} job cards...`,
  );
  for (let i = 0; i < clickableIds.length; i++) {
    const id = clickableIds[i];
    try {
      console.log(
        `   [${
          i + 1
        }/${clickableIds.length}] Clicking data-clickable-id="${id}"...`,
      );

      // Close any open modals first (SPAs often have close buttons or backdrop clicks)
      // Try common modal close patterns
      await page.locator('[class*="close"]').first().click().catch(() => {});
      await page.locator('[aria-label*="close" i]').first().click().catch(
        () => {},
      );
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);

      // Capture page state before click for comparison
      const beforeClick = await page.evaluate(() =>
        document.body.innerText.length
      );

      await page.locator(`[data-clickable-id="${id}"]`).click();

      // Wait for SPA to update - look for common modal/dialog/panel containers
      // This is a generic approach that works across different SPA frameworks
      await page.waitForTimeout(1000);

      // Check if page content changed after click
      const afterClick = await page.evaluate(() =>
        document.body.innerText.length
      );
      const contentChanged = Math.abs(afterClick - beforeClick) > 100;

      if (!contentChanged) {
        console.warn(
          `      ⚠️  Page content didn't change after click (before: ${beforeClick}, after: ${afterClick})`,
        );
      }

      // Try to find a modal/dialog/panel that appeared after the click
      // Check common modal selectors used by various UI frameworks
      const modalSelectors = [
        '[role="dialog"]', // ARIA standard
        '[role="alertdialog"]',
        ".modal", // Bootstrap
        ".modal-content",
        ".ant-modal", // Ant Design
        ".MuiDialog-root", // Material-UI
        ".dialog", // Generic
        '[class*="modal"]', // Any class containing "modal"
        '[class*="dialog"]',
        '[class*="drawer"]',
        '[class*="panel"][class*="detail"]',
      ];

      let modalContent = null;
      let modalSelector = null;

      // Try each selector to find the modal
      for (const selector of modalSelectors) {
        const modal = page.locator(selector).first();
        if (await modal.isVisible().catch(() => false)) {
          // Wait for modal to have substantial content (retry for up to 3 seconds)
          let attempts = 0;
          while (attempts < 6) {
            modalContent = await modal.innerHTML().catch(() => null);
            if (modalContent && modalContent.length > 1000) {
              // Check if this is a navigation/menu drawer (not job details)
              const lowerContent = modalContent.toLowerCase();
              const isNavDrawer = lowerContent.includes("dashboard") &&
                (lowerContent.includes("log out") ||
                  lowerContent.includes("logout") ||
                  lowerContent.includes("settings"));

              if (isNavDrawer) {
                console.log(
                  `      ⚠️  Skipping navigation drawer (${selector})`,
                );
                modalContent = null; // Reset to keep looking
                break;
              }

              // Found substantial non-nav modal content
              modalSelector = selector;
              console.log(
                `      ✓ Found modal: ${selector} (${
                  (modalContent.length / 1024).toFixed(1)
                } KB)`,
              );
              break;
            }
            await page.waitForTimeout(500);
            attempts++;
          }

          if (modalContent && modalContent.length > 1000) {
            break;
          }
        }
      }

      // If we found modal content, use it; otherwise fall back to full page
      const jobHtml = modalContent
        ? `<div class="job-detail-modal">${modalContent}</div>`
        : await page.content();

      if (!modalContent) {
        console.warn(
          "      ⚠️  No modal found, using full page HTML (may extract wrong job)",
        );
      }

      // Debug: Log first 500 chars of captured HTML
      if (config.scraperDebugMode) {
        const preview = stripHtmlForLlm(jobHtml).substring(0, 500);
        console.log(`      [DEBUG] HTML preview: ${preview}...`);
      }

      jobHtmlList.push(jobHtml);
      console.log(`      ✓ Captured job HTML`);
    } catch (error) {
      console.error(
        `      ✗ Failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log(
    `\n✅ SPA scraping complete: ${jobHtmlList.length} jobs captured\n`,
  );
  return jobHtmlList;
}

/**
 * Generic scraping logic for any job site
 */
async function scrapeJobSite(
  page: Page,
  searchAction: SearchAction,
): Promise<void> {
  if (!searchAction.search_url) {
    console.log("⚠ No search URL configured for this search action");
    return;
  }

  const searchUrl = searchAction.search_url;
  const siteConfig = getSiteConfig(searchUrl);
  const siteName = getSiteName(searchUrl);

  // 1. Navigate to search results - Playwright auto-waits!
  console.log(`Navigating to: ${searchUrl} (${siteName})`);

  // Determine navigation type early to optimize page.goto() strategy
  const navigationType = searchAction.navigation_type ||
    searchAction.job_platforms?.navigation_type ||
    siteConfig.navigationType || "url";

  // For SPAs (click-based), use "load" instead of "networkidle" to avoid timeout
  // SPAs often have continuous background activity that prevents networkidle
  const waitStrategy = navigationType === "click" ? "load" : "networkidle";
  const timeout = navigationType === "click"
    ? (siteConfig.timeout || config.scraperDefaultTimeout)
    : (siteConfig.timeout || config.scraperNetworkIdleTimeout);

  console.log(`Using wait strategy: "${waitStrategy}" (timeout: ${timeout}ms)`);

  await page.goto(searchUrl, {
    waitUntil: waitStrategy,
    timeout: timeout,
  });

  // Wait for specific element if configured
  if (siteConfig.selectors.jobListContainer) {
    await page.locator(siteConfig.selectors.jobListContainer).waitFor({
      state: "visible",
      timeout: siteConfig.timeout || 30000,
    }).catch(() => {
      console.warn(
        "⚠️  Expected job list container not found:",
        siteConfig.selectors.jobListContainer,
      );
    });
  }

  if (config.scraperSaveDebugScreenshots) {
    await saveDebugScreenshot(page, `search-${siteName}`);
  }

  // 2. Check if page is a login page
  if (await isLoginPage(page)) {
    const loginSuccessful = await waitForManualLogin(page);

    if (!loginSuccessful) {
      console.log("⚠️  Skipping this search due to login timeout");
      return;
    }

    // Navigate again after login
    await page.goto(searchUrl, {
      waitUntil: "networkidle",
      timeout: siteConfig.timeout || config.scraperNetworkIdleTimeout,
    });

    console.log("Waiting for search results to load after login...");
    if (siteConfig.selectors.jobListContainer) {
      await page.locator(siteConfig.selectors.jobListContainer).waitFor({
        state: "visible",
        timeout: siteConfig.timeout || 30000,
      }).catch(() => console.warn("⚠️  Job list container not found"));
    }
  }

  // Run custom validator if configured
  if (siteConfig.validator) {
    const isValid = await siteConfig.validator(page);
    if (!isValid) {
      console.warn("⚠️  Page validation failed");
    }
  }

  // 3. Determine platform ID (prefer from job_searches, fallback to URL lookup)
  const platformId = searchAction.platform ??
    await getPlatformIdFromUrl(searchUrl);

  // 4. Branch based on navigation type
  if (navigationType === "click") {
    // ============================================
    // CLICK-BASED NAVIGATION (SPAs)
    // ============================================
    try {
      const jobHtmlList = await scrapeJobsWithClicks(
        page,
        siteConfig,
        searchUrl,
      );

      if (jobHtmlList.length === 0) {
        console.log("⚠️  No jobs to process");
        return;
      }

      // Process each job HTML
      for (let i = 0; i < jobHtmlList.length; i++) {
        const jobHtml = jobHtmlList[i];
        // Use synthetic URL for SPAs (no actual URL navigation)
        const pseudoUrl = `${searchUrl}#job-${i + 1}`;

        try {
          console.log(`\nProcessing job ${i + 1}/${jobHtmlList.length}...`);

          const strippedHtml = stripHtmlForLlm(jobHtml);
          const htmlChanged = await hasHtmlChanged(
            pseudoUrl,
            strippedHtml,
            options.force,
          );

          if (!htmlChanged) {
            console.log(`⏭️  Skipping - HTML unchanged`);
            continue;
          }

          console.log("Extracting job data...");
          const jobData = await extractJobData(jobHtml, pseudoUrl);
          const result = await upsertJob(jobData, pseudoUrl, platformId);
          console.log(
            `✓ ${result.created ? "Created" : "Updated"} job #${result.id}`,
          );
        } catch (error) {
          console.error(
            `✗ Failed to process job ${i + 1}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } catch (error) {
      console.error(
        "❌ Error in click-based navigation:",
        error instanceof Error ? error.message : String(error),
      );

      if (error instanceof Error && error.message.includes("not found")) {
        console.log(
          "\n💡 Tip: Make sure the 'extract_job_click_selectors' prompt exists in the ai_chat_prompts table",
        );
      }
    }
  } else {
    // ============================================
    // URL-BASED NAVIGATION (Traditional)
    // ============================================
    try {
      const jobUrls = await scrapeJobsWithUrls(page, searchUrl);

      if (jobUrls.length === 0) {
        return;
      }

      // Process each job URL
      for (const url of jobUrls) {
        try {
          console.log(`\nProcessing: ${url}`);

          // Navigate to job page - Playwright auto-waits!
          await page.goto(url, {
            waitUntil: "networkidle",
            timeout: siteConfig.timeout || config.scraperDefaultTimeout,
          });

          // Optional: Wait for job description
          if (siteConfig.selectors.jobDescription) {
            await page.locator(siteConfig.selectors.jobDescription).waitFor({
              state: "visible",
              timeout: 10000,
            }).catch(() =>
              console.warn(
                "⚠️  Job description not found - content may be incomplete",
              )
            );
          }

          const jobHtml = await page.content();
          const strippedHtml = stripHtmlForLlm(jobHtml);

          const htmlChanged = await hasHtmlChanged(
            url,
            strippedHtml,
            options.force,
          );

          if (!htmlChanged) {
            console.log(`⏭️  Skipping - HTML unchanged`);
            continue;
          }

          console.log("Extracting job data...");
          const jobData = await extractJobData(jobHtml, url);
          const result = await upsertJob(jobData, url, platformId);
          console.log(
            `✓ ${result.created ? "Created" : "Updated"} job #${result.id}`,
          );

          // Delay to avoid rate limiting
          await page.waitForTimeout(2000);
        } catch (error) {
          console.error(
            `✗ Failed to process ${url}:`,
            error instanceof Error ? error.message : String(error),
          );

          if (error instanceof Error && error.message.includes("not found")) {
            console.log(
              "💡 Tip: Make sure the 'extract_job_data' prompt exists in the ai_chat_prompts table",
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "❌ Error extracting job links:",
        error instanceof Error ? error.message : String(error),
      );

      if (error instanceof Error && error.message.includes("not found")) {
        console.log(
          "\n💡 Tip: Make sure the 'extract_job_links' prompt exists in the ai_chat_prompts table",
        );
      }
    }
  }
}

/**
 * Determine import source from search URL hostname
 */
function getImportSource(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("linkedin.com")) return "LinkedIn";
    if (hostname.includes("indeed.com")) return "Indeed";
    if (hostname.includes("glassdoor.com")) return "Glassdoor";
    return hostname; // Fallback to hostname
  } catch {
    return "Unknown";
  }
}

/**
 * Re-scrape a single job by ID
 */
async function rescrapeJobById(
  jobId: number,
  context: BrowserContext,
): Promise<void> {
  console.log(`\n🔄 Re-scraping job #${jobId}...`);

  // 1. Look up job in database
  const job = await dbDirect.jobs.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      source_url: true,
      job_platform: true,
      title: true,
    },
  });

  if (!job) {
    console.error(`❌ Job #${jobId} not found in database`);
    return;
  }

  if (!job.source_url) {
    console.error(`❌ Job #${jobId} has no source_url - cannot re-scrape`);
    return;
  }

  console.log(`📄 Job: ${job.title || "Untitled"}`);
  console.log(`🔗 URL: ${job.source_url}`);

  // 2. Determine platform ID
  const platformId = job.job_platform ||
    await getPlatformIdFromUrl(job.source_url);
  console.log(`🔧 Platform ID: ${platformId}`);

  // Get site configuration
  const siteConfig = getSiteConfig(job.source_url);

  // 3. Navigate to job page
  const page = await context.newPage();

  try {
    console.log(`\n🌐 Navigating to job page...`);
    await page.goto(job.source_url, {
      waitUntil: "networkidle",
      timeout: siteConfig.timeout || config.scraperDefaultTimeout,
    });

    // Optional: Wait for job description
    if (siteConfig.selectors.jobDescription) {
      await page.locator(siteConfig.selectors.jobDescription).waitFor({
        state: "visible",
        timeout: 10000,
      }).catch(() => console.warn("⚠️  Job description not found"));
    }

    // 4. Check for login page
    const pageHtml = await page.content();
    const isLogin = await detectLoginPage(pageHtml);

    if (isLogin) {
      console.error(
        `❌ Login required. Please run full scrape to login manually.`,
      );
      await page.close();
      return;
    }

    // 5. Check if HTML has changed
    console.log(`🔍 Checking for HTML changes...`);
    const strippedHtml = stripHtmlForLlm(pageHtml);
    const htmlChanged = await hasHtmlChanged(
      job.source_url,
      strippedHtml,
      options.force,
    );

    if (!htmlChanged) {
      console.log(
        `⏭️  Skipping - HTML unchanged since last scrape (no new data to extract)`,
      );
      await page.close();
      return;
    }

    console.log(`✅ HTML has changed - proceeding with extraction`);

    // 6. Extract job data
    console.log(`📊 Extracting job data...`);
    const jobData = await extractJobData(pageHtml, job.source_url);

    if (!jobData) {
      console.error(`❌ Failed to extract job data`);
      await page.close();
      return;
    }

    // 7. Update job in database
    console.log(`💾 Updating job in database...`);
    const result = await upsertJob(jobData, job.source_url, platformId);

    console.log(
      `✅ Job #${result.id} updated successfully (scrape count: ${
        result.created ? 1 : "incremented"
      })`,
    );
  } catch (error) {
    console.error(
      `❌ Error scraping job #${jobId}:`,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await page.close();
  }
}

/**
 * Clear Directus cache
 */
async function clearDirectusCache(): Promise<void> {
  try {
    console.log("\n🧹 Clearing Directus cache...");
    await execAsync("npm run docker:clear-directus-cache");
    console.log("✅ Directus cache cleared");
  } catch (error) {
    console.error(
      "⚠️  Failed to clear Directus cache:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Main scraping function
 */
async function scrapeJobSites(): Promise<void> {
  // Ensure chrome profile directory exists
  const profileDir = join(process.cwd(), "chrome-profiles");
  const defaultProfileDir = join(profileDir, "default");
  if (!existsSync(defaultProfileDir)) {
    mkdirSync(defaultProfileDir, { recursive: true });
    console.log(`📁 Created profile directory: ${defaultProfileDir}`);
  }

  // Launch browser with persistent profile (same as login script)
  console.log("Launching browser...");
  const context = await launchBrowser(defaultProfileDir, {
    headless: false, // Set to true in production
  });

  const page = await context.newPage();

  try {
    // **NEW: Check if single job mode**
    if (options.jobId) {
      // Validate job ID
      if (isNaN(options.jobId)) {
        console.error("❌ Invalid job ID: must be a number");
        process.exit(1);
      }
      await rescrapeJobById(options.jobId, context);
      await context.close(); // Closes browser too (persistent context)
      return; // Exit after single job scrape
    }

    // 1. Fetch job searches (all active or specific search)
    const whereClause: { status?: string; id?: number } = {};

    if (options.searchId) {
      // Validate search ID
      if (isNaN(options.searchId)) {
        console.error("❌ Invalid search ID: must be a number");
        process.exit(1);
      }
      whereClause.id = options.searchId;
    } else {
      // Only filter by status if no specific search is requested
      whereClause.status = "active";
    }

    const searchActions = await dbDirect.job_searches.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        search_url: true,
        navigation_type: true,
        platform: true,
        job_platforms: {
          select: {
            navigation_type: true,
          },
        },
      },
    });

    if (searchActions.length === 0) {
      if (options.searchId) {
        console.error(`❌ Job search #${options.searchId} not found`);
      } else {
        console.log("⚠️  No active job searches found");
      }
      process.exit(1);
    }

    console.log(`\nFound ${searchActions.length} job search(es) to process\n`);

    // 2. For each search action
    for (const searchAction of searchActions) {
      console.log(`\n========================================`);
      console.log(`Search: ${searchAction.name}`);
      console.log(`========================================\n`);

      await scrapeJobSite(page, searchAction);

      // Update last_run timestamp
      await dbDirect.job_searches.update({
        where: { id: searchAction.id },
        data: { last_run: new Date() },
      });
    }

    console.log("\n\n✅ Scraping completed successfully!");
  } catch (error) {
    console.error(
      "❌ Scraping failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  } finally {
    await context.close(); // Closes browser too (persistent context)
    await clearDirectusCache();
  }
}

// Handle interrupts (Ctrl+C) and termination signals
let isExiting = false;

async function handleExit(signal: string) {
  if (isExiting) return;
  isExiting = true;

  console.log(`\n\n⚠️  Received ${signal}, cleaning up...`);
  await clearDirectusCache();
  process.exit(0);
}

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

// Execute
scrapeJobSites().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
