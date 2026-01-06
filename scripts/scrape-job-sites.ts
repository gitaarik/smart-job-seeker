#!/usr/bin/env node

/**
 * Job site scraping script
 * Uses Browser-Use to scrape job listings and extract data
 */

import { dbDirect } from "$lib/db";
import {
  extractJobData,
  getPlatformIdFromUrl,
  upsertJob,
} from "$lib/server/job-scraper";
import { Command } from "commander";
import { getSiteConfig, getSiteName } from "$lib/server/job-site-configs";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser-use-client";
import { parseRelativeDate } from "$lib/tools/date-utils";
import { clearDirectusCache } from "$lib/server/directus";
import {
  launchBrowser,
  waitForJobContentToLoad,
} from "$lib/server/browser-utils";
import { scrapeJobsWithUrls } from "$lib/server/scrapers/url-scraper";
import { scrapeJobsWithClicks } from "$lib/server/scrapers/click-scraper";
import { scrapeJobsWithBrowserUse } from "$lib/server/scrapers/browser-use-scraper";

interface SearchAction {
  id: number;
  name: string;
  search_url: string | null;
  navigation_type: "url" | "click" | null;
  platform: number | null;
  job_platforms: {
    navigation_type: "url" | "click" | null;
    pagination_type: string | null;
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
 * Generic scraping logic for any job site
 */
async function scrapeJobSite(
  searchAction: SearchAction,
): Promise<{ strippedHtml: string | null }> {
  if (!searchAction.search_url) {
    console.log("⚠ No search URL configured for this search action");
    return { strippedHtml: null };
  }

  const searchUrl = searchAction.search_url;
  const siteName = getSiteName(searchUrl);

  console.log(`\n🔗 Starting scrape: ${searchUrl} (${siteName})`);

  // Determine platform ID
  const platformId = searchAction.platform ??
    await getPlatformIdFromUrl(searchUrl);

  // Determine navigation type
  const navigationType = searchAction.navigation_type ||
    searchAction.job_platforms?.navigation_type ||
    getSiteConfig(searchUrl).navigationType || "url";

  // Get pagination type from platform config
  const paginationType = searchAction.job_platforms?.pagination_type || null;

  console.log(`📍 Navigation type: ${navigationType}`);
  if (paginationType) {
    console.log(`📄 Pagination type: ${paginationType}`);
  }
  console.log(`🔧 Scraper method: ${config.scraperMethod}`);

  let processedCount: number;
  let strippedHtml: string | null = null;

  try {
    if (config.scraperMethod === "playwright") {
      // Launch Playwright browser - force visible for manual login
      const headless = false; // Always visible so user can log in
      console.log(`🖥️  Browser mode: ${headless ? "headless" : "visible"}`);
      const context = await launchBrowser("/tmp/scraper-profile", {
        headless,
      });

      try {
        const page = await context.newPage();
        // Use domcontentloaded for SPAs (faster and more reliable than "load")
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        // Route by navigation type
        if (navigationType === "click") {
          const siteConfig = getSiteConfig(searchUrl);
          const result = await scrapeJobsWithClicks(
            page,
            siteConfig,
            searchUrl,
            platformId,
          );
          processedCount = result.jobsProcessed;
          strippedHtml = result.strippedHtml;
        } else {
          const result = await scrapeJobsWithUrls(
            page,
            searchUrl,
            platformId,
            paginationType,
          );
          processedCount = result.jobsProcessed;
          strippedHtml = result.strippedHtml;
        }
      } finally {
        await context.close(); // Always cleanup
      }
    } else {
      // Default: Browser-Use
      processedCount = await scrapeJobsWithBrowserUse(
        searchUrl,
        navigationType,
        platformId,
      );
    }

    console.log(`\n✅ Successfully processed ${processedCount} job(s)\n`);

    return { strippedHtml };
  } catch (error) {
    console.error(
      `❌ ${config.scraperMethod} scraping failed:`,
      error instanceof Error ? error.message : String(error),
    );

    if (
      config.scraperMethod === "browser-use" &&
      error instanceof Error &&
      error.message.includes("not found")
    ) {
      console.log(
        "\n💡 Tip: Make sure the 'extract_job_browser_use' prompt exists in the ai_chat_prompts table",
      );
    }

    throw error;
  }
}

/**
 * Re-scrape a single job by ID
 */
async function rescrapeJobById(
  jobId: number,
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

  try {
    // 3. Extract job data using configured scraper method
    console.log(`🔧 Scraper method: ${config.scraperMethod}`);

    let jobData: any;

    if (config.scraperMethod === "playwright") {
      console.log(`\n🤖 Using Playwright to extract job data...`);

      // Launch Playwright browser
      const context = await launchBrowser("/tmp/scraper-profile", {
        headless: config.isDevelopment ? false : true,
      });

      try {
        const page = await context.newPage();
        await page.goto(job.source_url, { waitUntil: "load", timeout: 30000 });

        // Wait for dynamic job content to load (e.g., LinkedIn's async-loaded descriptions)
        await waitForJobContentToLoad(page);

        // Get HTML content from the page
        const html = await page.content();

        // Extract job data from the HTML
        jobData = await extractJobData(html, job.source_url);
      } finally {
        await context.close(); // Always cleanup
      }
    } else {
      // Default: Browser-Use
      console.log(`\n🤖 Using Browser-Use to extract job data...`);
      const browserUse = new BrowserUseClient();
      jobData = await browserUse.extractSingleJob(job.source_url);
    }

    if (!jobData) {
      console.error(`❌ Failed to extract job data`);
      return;
    }

    // Parse date_posted if it's a string
    const datePosted = jobData.date_posted
      ? parseRelativeDate(jobData.date_posted as string)
      : null;

    // 4. Update job in database
    console.log(`💾 Updating job in database...`);
    const result = await upsertJob(
      {
        ...jobData,
        date_posted: datePosted,
      },
      job.source_url,
      platformId,
    );

    console.log(`✅ Job #${result.id} updated successfully`);
  } catch (error) {
    console.error(
      `❌ Error scraping job #${jobId}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Main scraping function
 */
async function scrapeJobSites(): Promise<void> {
  try {
    // Check if single job mode
    if (options.jobId) {
      if (isNaN(options.jobId)) {
        console.error("❌ Invalid job ID: must be a number");
        process.exit(1);
      }
      await rescrapeJobById(options.jobId);
      return;
    }

    // Fetch job searches (all active or specific search)
    const whereClause: { status?: string; id?: number } = {};

    if (options.searchId) {
      if (isNaN(options.searchId)) {
        console.error("❌ Invalid search ID: must be a number");
        process.exit(1);
      }
      whereClause.id = options.searchId;
    } else {
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
            pagination_type: true,
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

    // Process each search action
    for (const searchAction of searchActions) {
      console.log(`\n========================================`);
      console.log(`Search: ${searchAction.name}`);
      console.log(`========================================\n`);

      const scrapeResult = await scrapeJobSite(searchAction);

      // Update last_run timestamp and stripped HTML
      await dbDirect.job_searches.update({
        where: { id: searchAction.id },
        data: {
          last_run: new Date(),
          stripped_html: scrapeResult.strippedHtml,
        },
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
