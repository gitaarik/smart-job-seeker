/**
 * Single job card processing: click, extract, validate, and save
 */

import type { Page } from "playwright";
import { config } from "$lib/server/config";
import {
  getJobInvalidReason,
  isJobClosed,
  isJobTooOld,
  isValidJob,
} from "$lib/server/job/scrape-filters";
import { BrowserUseClient } from "$lib/server/browser/use-client";
import { formatSalary, upsertJob, type UpsertResult } from "../job-data";
import type { MergedJobData } from "../types";
import type { SearchContext } from "./types";
import { mergeJobData } from "./merge";
import { extractJobData, getDirectusJobUrl } from "./llm-extract";
import type { SearchPageJob } from "./page-processor";
import {
  clickJobCard,
  type ClickResult,
  getElementInfo,
  returnToSearchPage,
} from "./click-handler";
import { extractSourceUrl } from "./source-url";

/**
 * Result of processing a single job card
 */
export interface JobProcessingResult {
  success: boolean;
  jobId?: number;
  created?: boolean;
  skipped?: boolean;
  skipReason?: string;
  isClosed?: boolean;
  isStale?: boolean;
  error?: string;
  /** Whether processing this job required navigating away from search page */
  navigatedAway?: boolean;
  // Extracted job data for summary
  title?: string | null;
  company?: string | null;
  location?: string | null;
  remote?: string | null;
  jobType?: string | null;
  skills?: string[] | null;
}

/**
 * Format and log job data after save
 */
function formatJobOutput(
  jobData: MergedJobData,
  result: UpsertResult,
  sourceUrl: string | null,
): void {
  const action = result.created ? "✨ Created" : "📝 Updated";
  console.log(`\n      ${action} job #${result.id}`);
  console.log(`      ${"─".repeat(50)}`);

  // Core info
  console.log(`      📋 Title:       ${jobData.title || "(none)"}`);
  console.log(`      🏢 Company:     ${jobData.job_poster || "(none)"}`);
  console.log(`      📍 Location:    ${jobData.location || "(none)"}`);
  console.log(`      🏠 Remote:      ${jobData.remote || "(none)"}`);
  console.log(`      💼 Type:        ${jobData.job_type || "(none)"}`);
  console.log(`      📊 Level:       ${jobData.experience_level || "(none)"}`);
  console.log(`      📋 Status:      ${jobData.status || "(none)"}`);

  // Salary
  const salary = formatSalary(jobData);
  if (salary !== "-") {
    console.log(`      💰 Salary:      ${salary}`);
  }

  // Skills (show all)
  if (jobData.skills?.length) {
    console.log(`      🔧 Skills:      ${jobData.skills.join(", ")}`);
  }

  // Description preview (capped at 100 chars)
  if (jobData.job_description) {
    const preview = jobData.job_description.substring(0, 100).replace(
      /\n/g,
      " ",
    );
    console.log(`      📝 Description: ${preview}...`);
  }

  // URLs
  console.log(`      🔗 Source:      ${sourceUrl || "(unknown)"}`);
  console.log(`      🔗 Admin:       ${getDirectusJobUrl(result.id!)}`);

  // Show changes for updates
  if (!result.created && result.changes) {
    const c = result.changes;
    console.log(`      ${"─".repeat(50)}`);
    console.log(`      📊 Changes:`);
    if (c.status) {
      console.log(
        `         Status: ${c.status.old || "(none)"} → ${
          c.status.new || "(none)"
        }`,
      );
    }
    if (c.description) {
      console.log(`         Description: updated`);
    }
    if (c.skills) {
      if (c.skills.added.length) {
        console.log(`         Skills added: ${c.skills.added.join(", ")}`);
      }
      if (c.skills.removed.length) {
        console.log(`         Skills removed: ${c.skills.removed.join(", ")}`);
      }
    }
    if (c.salary) {
      console.log(`         Salary: ${c.salary.old} → ${c.salary.new}`);
    }
  }
}

/**
 * Process a single job card: click, extract, validate, and save
 *
 * @param jobSearchId Job search ID (required for profile lookup)
 * @param page Playwright page instance
 * @param searchJobData Job data from search page extraction
 * @param jobNumber Current job number (1-indexed)
 * @param totalJobs Total number of jobs on this page
 * @param searchUrl Base search URL
 * @param platformId Platform ID for job storage
 * @param browserUseClient Optional Browser-Use client for share button fallback
 * @returns Processing result with job ID if saved
 */
export async function processJobCard(
  jobSearchId: number,
  page: Page,
  searchJobData: SearchPageJob,
  jobNumber: number,
  totalJobs: number,
  searchUrl: string,
  platformId: string,
  browserUseClient?: BrowserUseClient,
): Promise<JobProcessingResult> {
  const { clickableId } = searchJobData;

  // Visual separator for each job
  console.log(`\n   [${"─".repeat(56)}]`);
  console.log(`   Job ${jobNumber}/${totalJobs}`);
  console.log(`   [${"─".repeat(56)}]`);

  // Get element info before clicking for debugging
  const elementInfo = await getElementInfo(page, clickableId);

  // Log click info concisely
  const clickText = elementInfo.text || elementInfo.ariaLabel || "(no text)";
  console.log(`      👆 Clicking #${clickableId}: "${clickText}"`);

  // Open job details (new tab for anchors, click for SPAs)
  const clickResult = await clickJobCard(page, clickableId, elementInfo.href);
  const { extractionPage, navigatedAway, newTab, contentChanged, originalUrl } =
    clickResult;

  // Skip if click didn't change page content (element highlighted for debugging)
  if (!contentChanged) {
    return {
      success: false,
      skipped: true,
      skipReason: "Click did not change page content",
    };
  }

  try {
    // Get full page HTML from the appropriate page
    const jobHtml = await extractionPage.content();

    // Build search context to help LLM identify the correct job
    const searchContext: SearchContext = {
      title: searchJobData.title,
      company: searchJobData.company,
      location: searchJobData.location,
    };

    // Extract job data from page (LLM may also extract source_url from content)
    const detailJobData = await extractJobData(
      jobSearchId,
      jobHtml,
      searchContext,
    );

    // Extract source URL using priority-based flow
    const sourceUrlResult = await extractSourceUrl({
      elementHref: elementInfo.href,
      originalUrl,
      navigatedAway,
      newTab,
      extractionPage,
      jobHtml,
      llmSourceUrl: detailJobData.source_url,
      browserUseClient,
    });

    // Override the LLM-extracted source_url with our determined value
    detailJobData.source_url = sourceUrlResult.url;

    // Merge search page data with detail page data
    const jobData = mergeJobData(searchJobData, detailJobData);

    // Skip if no meaningful data was extracted (invalid/expired page)
    if (!isValidJob(jobData)) {
      const reason = getJobInvalidReason(jobData);
      console.log(`      ⏭️  Skipping - ${reason}`);
      // Return to search page before returning
      await returnToSearchPage(page, clickResult);
      return {
        success: false,
        skipped: true,
        skipReason: reason ?? undefined,
        navigatedAway,
      };
    }

    // Age check: Mark old jobs as "stale" but still import them
    let isStale = false;
    if (isJobTooOld(jobData.date_posted, config.scraperMaxJobAge)) {
      jobData.status = "stale";
      isStale = true;
    }

    // Status check: Track closed jobs
    const isClosed = isJobClosed(jobData.status);

    // Save job and show formatted output
    const result = await upsertJob(jobData, jobData.source_url, platformId);

    // Handle skipped jobs (missing required uniqueness fields)
    if (result.skipped) {
      console.log(`      ⚠️ Skipped: ${result.skipReason}`);
      await returnToSearchPage(page, clickResult);
      return {
        success: false,
        skipped: true,
        skipReason: result.skipReason,
      };
    }

    formatJobOutput(jobData, result, jobData.source_url);

    // Return to search page for the next job
    await returnToSearchPage(page, clickResult);

    return {
      success: true,
      jobId: result.id!,
      created: result.created,
      isClosed,
      isStale,
      navigatedAway,
      title: jobData.title,
      company: jobData.job_poster,
      location: jobData.location,
      remote: jobData.remote,
      jobType: jobData.job_type,
      skills: jobData.skills,
    };
  } catch (error) {
    // Ensure we return to search page even on error
    await returnToSearchPage(page, clickResult);
    throw error;
  }
}
