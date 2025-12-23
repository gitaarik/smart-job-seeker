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
  keywords: string | null;
  location: string | null;
  job_type: string | null; // Comma-separated values for multiple selections
  experience_level: string | null; // Comma-separated values for multiple selections
  remote: string | null; // Comma-separated values for multiple selections
  user_search_actions_job_sites: Array<{
    job_sites: JobSite | null;
  }>;
}

interface JobSite {
  id: number;
  name: string;
  search_url_base: string;
  search_param_mappings: unknown;
}

/**
 * LinkedIn-specific scraping logic
 */
async function scrapeLinkedIn(
  page: Page,
  searchAction: SearchAction,
  jobSite: JobSite,
): Promise<void> {
  // 1. Build search URL using search_param_mappings
  const params = new URLSearchParams();
  const mappings = jobSite.search_param_mappings as Record<string, string>;

  // Map each field from searchAction to the site-specific parameter
  const searchFields = {
    keywords: searchAction.keywords,
    location: searchAction.location,
    job_type: searchAction.job_type,
    experience_level: searchAction.experience_level,
    remote: searchAction.remote,
  };

  for (const [internalKey, value] of Object.entries(searchFields)) {
    if (value && mappings[internalKey]) {
      // Handle comma-separated values for multiple selections
      params.set(mappings[internalKey], value);
    }
  }

  const searchUrl = `${jobSite.search_url_base}?${params.toString()}`;

  // 2. Navigate to search results
  console.log(`Navigating to: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: "networkidle2" });

  // 3. Get page HTML
  const html = await page.content();

  // 4. Extract job links using LLM
  console.log("Extracting job links...");
  const jobUrls = await extractJobLinks(html);
  console.log(`Found ${jobUrls.length} jobs`);

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
      const result = await upsertJob(jobData, url, "LinkedIn");
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
    // 1. Fetch all active user search actions with their related job sites
    const searchActions = await dbDirect.user_search_actions.findMany({
      where: { status: "active" },
      include: {
        profiles: true,
        user_search_actions_job_sites: {
          include: {
            job_sites: true,
          },
        },
      },
    });

    console.log(`\nFound ${searchActions.length} active search action(s)\n`);

    // 2. For each search action
    for (const searchAction of searchActions) {
      console.log(`\n========================================`);
      console.log(`Search Action: ${searchAction.name}`);
      console.log(`========================================\n`);

      // Get enabled job sites from M2M relationship
      const enabledJobSites = searchAction.user_search_actions_job_sites
        .map((junction) => junction.job_sites)
        .filter((site): site is NonNullable<typeof site> =>
          site !== null && site.status === "active"
        );

      if (enabledJobSites.length === 0) {
        console.log("⚠ No active job sites enabled for this search action");
        continue;
      }

      // 3. For each enabled job site
      for (const jobSite of enabledJobSites) {
        console.log(`\n--- Scraping ${jobSite.name} ---\n`);

        // Site-specific scraping logic
        if (jobSite.name === "LinkedIn") {
          await scrapeLinkedIn(page, searchAction, jobSite);
        }
        // Add more job sites here as needed
      }

      // Update last_run timestamp
      await dbDirect.user_search_actions.update({
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
