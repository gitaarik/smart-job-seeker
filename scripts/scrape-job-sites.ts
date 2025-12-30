#!/usr/bin/env node

/**
 * Job site scraping script
 * Uses Browser-Use to scrape job listings and extract data
 */

import { dbDirect } from "$lib/db";
import { getPlatformIdFromUrl, upsertJob } from "$lib/server/job-scraper";
import { Command } from "commander";
import { getSiteConfig, getSiteName } from "$lib/server/job-site-configs";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser-use-client";
import { parseRelativeDate } from "$lib/tools/date-utils";
import { isJobClosed, isJobTooOld } from "$lib/server/scrape-filters";
import { interpolatePrompt } from "$lib/server/ai-chat-utils";
import { clearDirectusCache } from "$lib/server/directus";

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
 * BROWSER-USE SCRAPING (Unified for both URL and Click modes)
 * Uses Browser-Use API to directly extract structured job data
 */
async function scrapeJobsWithBrowserUse(
  searchUrl: string,
  navigationType: "url" | "click",
  platformId: string,
): Promise<number> {
  console.log(`\n🤖 Using Browser-Use (${navigationType} mode)...`);

  // Use default config automatically
  const browserUse = new BrowserUseClient();

  // Fetch prompt template from Directus
  const template = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "extract_job_browser_use" },
  });

  if (!template) {
    throw new Error(
      "Prompt template 'extract_job_browser_use' not found in ai_chat_prompts",
    );
  }

  // Build navigation instructions based on mode
  const navigationInstructions = navigationType === "url"
    ? `Navigate through pagination links/buttons to find more jobs. Stop after finding ${config.scraperMaxJobsPerSearch} jobs or ${config.scraperPaginationMaxPages} pages.`
    : `Click on each job card to view details. Stop after finding ${config.scraperMaxJobsPerSearch} jobs.`;

  // Interpolate variables in the user prompt
  const systemPrompt = template.system_prompt || "";
  const userPrompt = interpolatePrompt(template.user_prompt || "", {
    navigationInstructions,
  });

  // Combine system and user prompts for the Browser-Use task
  const task = `${systemPrompt}\n\n${userPrompt}`.trim();

  // Execute the task
  const response = await browserUse.executeTask({
    task,
    startUrl: searchUrl,
    maxTime: 180, // 3 minutes max
  });

  // Parse the JSON result
  let jobs: any[];
  try {
    // The result might be a string containing JSON or already parsed
    const resultStr = typeof response.result === "string"
      ? response.result
      : JSON.stringify(response.result);

    // Try to extract JSON from the result
    const jsonMatch = resultStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jobs = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON array found in response");
    }
  } catch (error) {
    console.error("❌ Failed to parse Browser-Use response:", error);
    console.log("Raw response:", response.result);
    throw new Error("Browser-Use returned invalid JSON");
  }

  console.log(`✅ Browser-Use extracted ${jobs.length} jobs`);

  // Apply filters and save
  let processedCount = 0;
  for (const jobData of jobs) {
    // Parse date_posted if it's a string
    const datePosted = jobData.date_posted
      ? parseRelativeDate(jobData.date_posted)
      : null;

    // Apply filters
    if (isJobTooOld(datePosted, config.scraperMaxJobAge)) {
      console.log(`   ⏭️  Skipping - too old: ${jobData.title}`);
      continue;
    }
    if (isJobClosed(jobData.status)) {
      console.log(`   ⏭️  Skipping - closed: ${jobData.title}`);
      continue;
    }

    // Save using existing logic
    await upsertJob(
      {
        ...jobData,
        date_posted: datePosted,
      },
      jobData.application_url,
      platformId,
    );
    processedCount++;
  }

  return processedCount;
}

/**
 * Generic scraping logic for any job site
 */
async function scrapeJobSite(
  searchAction: SearchAction,
): Promise<void> {
  if (!searchAction.search_url) {
    console.log("⚠ No search URL configured for this search action");
    return;
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

  console.log(`📍 Navigation type: ${navigationType}`);

  try {
    const processedCount = await scrapeJobsWithBrowserUse(
      searchUrl,
      navigationType,
      platformId,
    );

    console.log(`\n✅ Successfully processed ${processedCount} job(s)\n`);
  } catch (error) {
    console.error(
      "❌ Browser-Use scraping failed:",
      error instanceof Error ? error.message : String(error),
    );

    if (error instanceof Error && error.message.includes("not found")) {
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
    // 3. Use Browser-Use to extract job data
    console.log(`\n🤖 Using Browser-Use to extract job data...`);
    const browserUse = new BrowserUseClient();
    const jobData = await browserUse.extractSingleJob(job.source_url);

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

      await scrapeJobSite(searchAction);

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
