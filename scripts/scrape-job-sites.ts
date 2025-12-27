#!/usr/bin/env node

/**
 * Job site scraping script
 * Uses Playwright to scrape job listings and LLM to extract data
 */

import { type Browser, type BrowserContext, type Page } from "playwright";
import {
  createBrowserContext,
  launchStealthBrowser,
} from "$lib/server/browser-utils";
import { dbDirect } from "$lib/db";
import {
  detectLoginPage,
  extractJobData,
  extractJobLinks,
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
  await page.goto(searchUrl, {
    waitUntil: "networkidle",
    timeout: siteConfig.timeout || config.scraperNetworkIdleTimeout,
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

  // 3. Get page HTML
  const html = await page.content();

  // 4. Extract job links using LLM
  console.log("Extracting job links...");
  let jobUrls: string[];
  try {
    jobUrls = await extractJobLinks(html);

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

      return;
    }

    // Convert relative URLs to absolute URLs
    const baseUrl = new URL(searchUrl);
    jobUrls = jobUrls.map((url) => {
      // If URL is relative, make it absolute
      if (url.startsWith("/")) {
        return `${baseUrl.origin}${url}`;
      }
      return url;
    });

    console.log(`Found ${jobUrls.length} job link(s)`);
  } catch (error) {
    console.error(
      "❌ Error extracting job links:",
      error instanceof Error ? error.message : String(error),
    );

    // Check if it's a missing prompt error
    if (
      error instanceof Error && error.message.includes("not found")
    ) {
      console.log(
        "\n💡 Tip: Make sure the 'extract_job_links' prompt exists in the ai_chat_prompts table in Directus",
      );
    }

    return;
  }

  // 4. Determine import source from URL
  const importSource = getImportSource(searchUrl);

  // 5. Process each job
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

      // Strip HTML early to check for changes
      const strippedHtml = stripHtmlForLlm(jobHtml);

      // Check if HTML has changed compared to existing job
      const htmlChanged = await hasHtmlChanged(
        url,
        strippedHtml,
        options.force,
      );

      if (!htmlChanged) {
        console.log(
          `⏭️  Skipping - HTML unchanged (no new data to extract)`,
        );
        continue;
      }

      // Extract job data using LLM
      console.log("Extracting job data...");
      const jobData = await extractJobData(jobHtml, url);

      // Create/update job
      const result = await upsertJob(jobData, url, importSource);
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

      // Check if it's a missing prompt error
      if (
        error instanceof Error && error.message.includes("not found")
      ) {
        console.log(
          "💡 Tip: Make sure the 'extract_job_data' prompt exists in the ai_chat_prompts table",
        );
      }

      // Continue with next job
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
      import_source: true,
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

  // 2. Determine import source (scraper type)
  const importSource = job.import_source || getImportSource(job.source_url);
  console.log(`🔧 Scraper: ${importSource}`);

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
        `❌ Login required for ${importSource}. Please run full scrape to login manually.`,
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
    const result = await upsertJob(jobData, job.source_url, importSource);

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
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  // Launch browser with persistent profile
  console.log("Launching browser...");
  const browser = await launchStealthBrowser({
    headless: false, // Set to true in production
  });

  // Create browser context with persistent storage
  const context = await createBrowserContext(browser, {
    userDataDir: join(profileDir, "default"),
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
      await context.close(); // Close context first
      await browser.close();
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
    await context.close(); // Close context first
    await browser.close();
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
