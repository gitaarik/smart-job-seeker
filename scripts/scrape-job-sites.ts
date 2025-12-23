#!/usr/bin/env node

/**
 * Job site scraping script
 * Uses Puppeteer to scrape job listings and LLM to extract data
 */

import puppeteer, { type Page } from "puppeteer";
import { dbDirect } from "$lib/db";
import {
  extractJobData,
  extractJobLinks,
  upsertJob,
} from "$lib/server/job-scraper";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

interface SearchAction {
  id: number;
  name: string;
  search_url: string | null;
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

  // 1. Navigate to search results
  console.log(`Navigating to: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: "networkidle2" });

  // 2. Get page HTML
  const html = await page.content();

  // 3. Extract job links using LLM
  console.log("Extracting job links...");
  const jobUrls = await extractJobLinks(html);
  console.log(`Found ${jobUrls.length} jobs`);

  // 4. Determine import source from URL
  const importSource = getImportSource(searchUrl);

  // 5. Process each job
  for (const url of jobUrls) {
    try {
      console.log(`\nProcessing: ${url}`);

      // Navigate to job page
      await page.goto(url, { waitUntil: "networkidle2" });
      const jobHtml = await page.content();

      // Extract job data using LLM
      console.log("Extracting job data...");
      const jobData = await extractJobData(jobHtml, url);

      // Create/update job
      const result = await upsertJob(jobData, url, importSource);
      console.log(
        `✓ ${result.created ? "Created" : "Updated"} job #${result.id}`,
      );

      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(
        `✗ Failed to process ${url}:`,
        error instanceof Error ? error.message : String(error),
      );
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
  const browser = await puppeteer.launch({
    headless: false, // Set to true in production
    userDataDir: join(profileDir, "default"),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  try {
    // 1. Fetch all active job searches
    const searchActions = await dbDirect.job_searches.findMany({
      where: { status: "active" },
    });

    console.log(`\nFound ${searchActions.length} active search action(s)\n`);

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
    await browser.close();
  }
}

// Execute
scrapeJobSites().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
