#!/usr/bin/env node

/**
 * Job site scraping script
 * Uses Puppeteer to scrape job listings and LLM to extract data
 */

import puppeteer, { type Page } from "puppeteer";
import { dbDirect } from "$lib/db";
import {
  detectLoginPage,
  extractJobData,
  extractJobLinks,
  upsertJob,
} from "$lib/server/job-scraper";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface SearchAction {
  id: number;
  name: string;
  search_url: string | null;
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
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

  // 1. Navigate to search results
  console.log(`Navigating to: ${searchUrl}`);
  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for page to settle
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 2. Check if page is a login page
  if (await isLoginPage(page)) {
    const loginSuccessful = await waitForManualLogin(page);

    if (!loginSuccessful) {
      console.log("⚠️  Skipping this search due to login timeout");
      return;
    }

    // Navigate again after login
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Wait for page to settle
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // 3. Get page HTML
  const html = await page.content();

  // 4. Extract job links using LLM
  console.log("Extracting job links...");
  let jobUrls: string[];
  try {
    jobUrls = await extractJobLinks(html);

    if (!jobUrls || jobUrls.length === 0) {
      console.log("⚠️  No job links found. This might indicate:");
      console.log("   - LinkedIn detected automation and blocked access");
      console.log("   - The search returned no results");
      console.log("   - The page structure has changed");
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

      // Navigate to job page
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      // Wait for page to settle
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
