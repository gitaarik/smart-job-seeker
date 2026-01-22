/**
 * Main click-based job scraping orchestrator
 * Coordinates page processing, job extraction, and pagination
 */

import type { Page } from "playwright";
import { config } from "$lib/server/config";
import {
  checkStopConditions,
  isFatalScraperError,
} from "$lib/server/job/scrape-filters";
import {
  detectPaginationStrategy,
  navigateToNextPage,
  performInfiniteScroll,
} from "$lib/server/utils/pagination";
import { getErrorMessage, promptUser } from "../utils";
import {
  humanWait,
  injectStealthScripts,
} from "$lib/server/browser/stealth-utils";
import { processSearchPage, type SearchPageJob } from "./page-processor";
import { processJobCard } from "./job-processor";
import { detectDuplicatePage, detectLoginPage } from "./page-guards";
import { waitForSpaContent } from "$lib/server/utils/page-wait";

/**
 * Stats tracked during scraping
 */
interface ScrapeStats {
  jobsProcessed: number;
  consecutiveClosedJobs: number;
  jobsImportedStale: number;
  jobsImportedClosed: number;
}

/**
 * Job data for end summary
 */
interface ProcessedJobSummary {
  id: number;
  title: string | null;
  company: string | null;
  location: string | null;
  remote: string | null;
  jobType: string | null;
  skills: string[] | null;
}

/**
 * Check if an error is a recoverable click/element error
 * These are errors where the element wasn't found or couldn't be clicked,
 * not fatal errors like auth failures or quota exceeded
 */
function isClickError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("element") ||
    msg.includes("locator") ||
    msg.includes("waiting for")
  );
}

/**
 * Print final stats summary
 */
function printFinalSummary(
  stats: ScrapeStats,
  processedJobs: ProcessedJobSummary[],
): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅ SPA scraping complete:`);
  console.log(`   Jobs saved: ${stats.jobsProcessed}`);
  console.log(`   Stale (old): ${stats.jobsImportedStale}`);
  console.log(`   Closed: ${stats.jobsImportedClosed}`);
  console.log(`${"═".repeat(60)}`);

  // Jobs summary
  if (processedJobs.length > 0) {
    console.log(`\n📊 Jobs Summary (${processedJobs.length} processed)`);
    console.log(`${"═".repeat(60)}`);
    for (const job of processedJobs) {
      console.log(`#${job.id} ${job.title || "(no title)"}`);
      const details = [
        job.company ? `🏢 ${job.company}` : null,
        job.location ? `📍 ${job.location}` : null,
        job.remote ? `🏠 ${job.remote}` : null,
        job.jobType ? `💼 ${job.jobType}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      if (details) console.log(`     ${details}`);
      if (job.skills?.length) {
        const skillsStr = job.skills.slice(0, 5).join(", ");
        const suffix = job.skills.length > 5 ? ", ..." : "";
        console.log(`     🔧 ${skillsStr}${suffix}`);
      }
      console.log("");
    }
    console.log(`${"═".repeat(60)}`);
  }
  console.log("");
}

/**
 * Ask user to confirm before processing jobs (first page only)
 */
async function confirmWithUser(jobs: SearchPageJob[]): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 Found ${jobs.length} job cards to process:\n`);

  for (const job of jobs) {
    const title = job.title || "(no title)";
    const company = job.company || "(no company)";
    console.log(`  #${job.clickableId}: ${title} @ ${company}`);
  }

  console.log(`\n${"=".repeat(60)}`);

  let answer = "";
  while (answer !== "y" && answer !== "n") {
    answer = (
      await promptUser(
        `\nProceed with importing these ${jobs.length} jobs? (y/n): `,
      )
    ).toLowerCase();
  }

  if (answer !== "y") {
    console.log("❌ Scraping cancelled by user");
    return false;
  }

  console.log("✅ Proceeding with import...\n");
  return true;
}

/**
 * Handle pagination: infinite scroll or traditional pagination
 * @returns true if there's a next page, false to stop
 */
async function handlePagination(page: Page): Promise<boolean> {
  console.log("\n   🔍 Checking for more pages...");
  const paginationInfo = await detectPaginationStrategy(page);

  if (paginationInfo.hasInfiniteScroll || paginationInfo.loadMoreSelector) {
    console.log("      Infinite scroll detected, scrolling...");
    const newContent = await performInfiniteScroll(page, {
      maxScrolls: config.scraperInfiniteScrollMaxScrolls,
    });

    if (newContent === 0) {
      console.log("      No new content after scroll, stopping");
      return false;
    }
    return true;
  }

  if (paginationInfo.hasPagination) {
    console.log("      Pagination detected, navigating to next page...");
    const hasNext = await navigateToNextPage(page, paginationInfo);

    if (!hasNext) {
      console.log("      No more pages");
      return false;
    }

    await humanWait(page, config.scraperRateLimitDelay);
    return true;
  }

  console.log("      No pagination detected, stopping");
  return false;
}

/**
 * Process all jobs on a page
 */
async function processPageJobs(
  jobSearchId: number,
  page: Page,
  jobs: SearchPageJob[],
  searchUrl: string,
  platformId: string,
  stats: ScrapeStats,
  processedJobs: ProcessedJobSummary[],
): Promise<{ shouldStop: boolean; stopReason?: string }> {
  console.log(
    `\n   👆 Step 3/3: Clicking and processing ${jobs.length} job cards...\n`,
  );

  // Track if we've navigated away (DOM could have changed after returning)
  let hasNavigatedAway = false;
  // Track jobs we've already attempted recovery for (by title)
  const retriedJobTitles = new Set<string>();

  for (let i = 0; i < jobs.length; i++) {
    const searchJobData = jobs[i];
    const jobNumber = i + 1;

    try {
      const result = await processJobCard(
        jobSearchId,
        page,
        searchJobData,
        jobNumber,
        jobs.length,
        searchUrl,
        platformId,
      );

      // Track if this job caused navigation (for recovery logic)
      if (result.navigatedAway) {
        hasNavigatedAway = true;
      }

      if (result.skipped) {
        stats.consecutiveClosedJobs = 0; // Reset counter for invalid pages
        continue;
      }

      if (result.success && result.jobId) {
        // Track stats
        if (result.isStale) stats.jobsImportedStale++;
        if (result.isClosed) {
          stats.jobsImportedClosed++;
          stats.consecutiveClosedJobs++;
        } else {
          stats.consecutiveClosedJobs = 0;
        }

        // Collect for summary
        processedJobs.push({
          id: result.jobId,
          title: result.title ?? null,
          company: result.company ?? null,
          location: result.location ?? null,
          remote: result.remote ?? null,
          jobType: result.jobType ?? null,
          skills: result.skills ?? null,
        });

        stats.jobsProcessed++;

        // Check stop conditions
        const stopCheck = checkStopConditions(stats, {
          maxJobsPerSearch: config.scraperMaxJobsPerSearch,
          consecutiveClosedLimit: config.scraperConsecutiveClosedLimit,
        });
        if (stopCheck.shouldStop) {
          console.log(`\n      🛑 ${stopCheck.reason}`);
          return { shouldStop: true, stopReason: stopCheck.reason };
        }
      }
    } catch (error) {
      const errMessage = getErrorMessage(error);
      console.error(`      ❌ Error processing job ${jobNumber}:`, errMessage);

      // Check if this is a fatal error
      const err = error instanceof Error ? error : new Error(errMessage);
      if (isFatalScraperError(err)) {
        console.error(
          `\n🛑 Fatal error encountered - stopping scraper: ${errMessage}`,
        );
        return { shouldStop: true, stopReason: errMessage };
      }

      // Attempt recovery if:
      // 1. This is a click/element error (not fatal)
      // 2. We've navigated away before (DOM could have changed)
      // 3. Haven't already retried this job
      const jobTitle = searchJobData.title || "";
      if (
        isClickError(error) &&
        hasNavigatedAway &&
        jobTitle &&
        !retriedJobTitles.has(jobTitle)
      ) {
        console.log(
          `      🔄 Click failed after navigation, attempting recovery...`,
        );
        retriedJobTitles.add(jobTitle);

        try {
          // Ensure we're on the search page
          const currentUrl = page.url();
          if (!currentUrl.includes(new URL(searchUrl).hostname)) {
            await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
            await humanWait(page, 1500);
          }

          // Re-mark and re-extract jobs
          console.log(`      📍 Re-marking and re-extracting job cards...`);
          const recoveryResult = await processSearchPage(
            jobSearchId,
            page,
            searchUrl,
            1,
            null,
          );

          if (recoveryResult.jobs.length > 0) {
            // Find matching job by title
            const matchingJob = recoveryResult.jobs.find(
              (j) => j.title === jobTitle,
            );

            if (matchingJob) {
              console.log(
                `      ✓ Found job "${jobTitle}" with new clickable ID ${matchingJob.clickableId}`,
              );
              // Update the job data and retry
              searchJobData.clickableId = matchingJob.clickableId;
              i--; // Retry same index
              continue;
            } else {
              console.log(
                `      ⚠️  Could not find job "${jobTitle}" after recovery, skipping`,
              );
            }
          }
        } catch (recoveryError) {
          console.error(
            `      ⚠️  Recovery failed:`,
            getErrorMessage(recoveryError),
          );
        }
      } else if (isClickError(error) && !hasNavigatedAway) {
        console.log(
          `      ⚠️  Click failed on first navigation - not a DOM change issue`,
        );
      }

      stats.consecutiveClosedJobs = 0;
    }
  }

  return { shouldStop: false };
}

/**
 * Scrape jobs using click-based navigation (SPAs)
 * Marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 * Extracts and saves jobs immediately during clicking for real-time feedback
 *
 * @param jobSearchId Job search ID (required for profile lookup and logging)
 * @param page Patchright page instance
 * @param searchUrl URL of the search results page
 * @param platformId Platform ID for job storage
 * @returns Object with jobsProcessed count and strippedHtml for debugging
 */
export async function scrapeJobsWithClicks(
  jobSearchId: number,
  page: Page,
  searchUrl: string,
  platformId: string,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
  console.log("\n🔄 Starting SPA scraping mode (click-based navigation)");

  // Inject stealth scripts
  await injectStealthScripts(page);

  // Wait for SPA content to stabilize before first extraction
  console.log("⏳ Waiting for SPA content to stabilize...");
  const initialWait = await waitForSpaContent(page, {
    maxAttempts: config.scraperSpaContentPollAttempts,
    pollInterval: config.scraperSpaContentPollInterval,
    minGrowthThreshold: config.scraperSpaMinContentGrowth,
  });
  console.log(
    `   Content ${
      initialWait.stabilized ? "stabilized" : "still loading"
    } at ${initialWait.contentLength.toLocaleString()} chars`,
  );
  console.log(`📍 Current URL: ${page.url()}`);

  // Initialize tracking
  const stats: ScrapeStats = {
    jobsProcessed: 0,
    consecutiveClosedJobs: 0,
    jobsImportedStale: 0,
    jobsImportedClosed: 0,
  };
  const processedJobs: ProcessedJobSummary[] = [];
  let savedStrippedHtml = "";
  let previousPageJobIds: number[] = [];
  let pageNumber = 1;

  // Pagination loop
  while (pageNumber <= config.scraperPaginationMaxPages) {
    // Step 1-2: Process search page (CDP marking, classification, LLM extraction)
    const pageResult = await processSearchPage(
      jobSearchId,
      page,
      pageNumber,
      savedStrippedHtml,
    );

    savedStrippedHtml = pageResult.strippedHtml;

    // Handle extraction errors
    if (pageResult.error) {
      console.log(
        `      ℹ️  Returning stripped HTML for debugging (${savedStrippedHtml.length} chars)`,
      );
      return {
        jobsProcessed: stats.jobsProcessed,
        strippedHtml: savedStrippedHtml,
      };
    }

    // No clickables found
    if (pageResult.clickableCount === 0) {
      break;
    }

    const { jobs } = pageResult;

    // First page: Ask user confirmation
    if (pageNumber === 1 && jobs.length > 0) {
      const confirmed = await confirmWithUser(jobs);
      if (!confirmed) {
        return { jobsProcessed: 0, strippedHtml: savedStrippedHtml };
      }
    }

    // Check for duplicate page (SPA pagination artifact)
    if (pageNumber > 1 && previousPageJobIds.length > 0) {
      const currentJobIds = jobs.map((j) => j.clickableId);
      const duplicateResult = detectDuplicatePage(
        currentJobIds,
        previousPageJobIds,
      );
      if (duplicateResult.isDuplicate) {
        break;
      }
    }

    // Store current page job IDs for next iteration
    previousPageJobIds = jobs.map((j) => j.clickableId);

    // Check for login page
    const loginResult = await detectLoginPage(page, jobs.length);
    if (loginResult.isLoginPage) {
      break;
    }

    // No jobs found
    if (jobs.length === 0) {
      console.log("      ⚠️  No job cards found in the page");
      break;
    }

    // Step 3: Process each job
    const processResult = await processPageJobs(
      jobSearchId,
      page,
      jobs,
      searchUrl,
      platformId,
      stats,
      processedJobs,
    );

    if (processResult.shouldStop) {
      printFinalSummary(stats, processedJobs);
      return {
        jobsProcessed: stats.jobsProcessed,
        strippedHtml: savedStrippedHtml,
      };
    }

    // Try to load more content
    const hasMore = await handlePagination(page);
    if (!hasMore) {
      break;
    }

    pageNumber++;
  }

  printFinalSummary(stats, processedJobs);
  return {
    jobsProcessed: stats.jobsProcessed,
    strippedHtml: savedStrippedHtml,
  };
}
