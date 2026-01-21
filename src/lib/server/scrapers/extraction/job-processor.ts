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
} from "$lib/server/scrape-filters";
import { humanClick, humanWait } from "$lib/server/stealth-utils";
import { formatSalary, upsertJob, type UpsertResult } from "../job-data";
import type { SearchContext } from "./types";
import { mergeJobData } from "./merge";
import { extractJobData, getDirectusJobUrl } from "./llm-extract";
import type { SearchPageJob } from "./page-processor";

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
  // Extracted job data for summary
  title?: string | null;
  company?: string | null;
  location?: string | null;
  remote?: string | null;
  jobType?: string | null;
  skills?: string[] | null;
}

/**
 * Get element info before clicking for debugging
 */
async function getElementInfo(
  page: Page,
  clickableId: number,
): Promise<{
  tag: string;
  text: string;
  href: string;
  ariaLabel: string;
  className: string;
}> {
  return await page
    .locator(`[data-extract-clickable-id="${clickableId}"]`)
    .evaluate((el) => {
      const tag = el.tagName.toLowerCase();
      // Normalize whitespace (collapse newlines/spaces) then trim
      const text =
        el.textContent?.replace(/\s+/g, " ").trim().substring(0, 50) || "";
      const href = el.getAttribute("href")?.substring(0, 60) || "";
      const ariaLabel = el.getAttribute("aria-label")?.substring(0, 50) || "";
      const className = el.className?.toString().substring(0, 50) || "";
      return { tag, text, href, ariaLabel, className };
    })
    .catch(() => ({
      tag: "?",
      text: "",
      href: "",
      ariaLabel: "",
      className: "",
    }));
}

/**
 * Merged job data type (from search + detail pages)
 */
type MergedJobData = {
  title: string;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  date_posted: Date | null;
  location: string | null;
  remote: string | null;
  experience_level: string | null;
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[] | null;
  status: string | null;
};

/**
 * Format and log job data after save
 */
function formatJobOutput(
  jobData: MergedJobData,
  result: UpsertResult,
  sourceUrl: string,
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
  console.log(`      🔗 Source:      ${sourceUrl}`);
  console.log(`      🔗 Admin:       ${getDirectusJobUrl(result.id)}`);

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
 * Click on a job card element and wait for content to load
 * @returns true if content changed after click
 */
async function clickJobCard(
  page: Page,
  clickableId: number,
): Promise<boolean> {
  // Press Escape to clear any stray modals
  await page.keyboard.press("Escape").catch(() => {});

  // Capture page state before click for comparison
  const beforeClick = await page.evaluate(() => document.body.innerText.length);

  // Use human-like click with natural mouse movement
  const selector = `[data-extract-clickable-id="${clickableId}"]`;
  await humanClick(page, selector);

  await humanWait(page, config.scraperClickWaitTimeout);

  // Check if page content changed after click
  const afterClick = await page.evaluate(() => document.body.innerText.length);
  const contentChanged = Math.abs(afterClick - beforeClick) > 100;

  if (!contentChanged) {
    console.warn(
      `      ⚠️  Page content didn't change after click (before: ${beforeClick}, after: ${afterClick})`,
    );
  }

  return contentChanged;
}

/**
 * Process a single job card: click, extract, validate, and save
 *
 * @param page Playwright page instance
 * @param searchJobData Job data from search page extraction
 * @param jobNumber Current job number (1-indexed)
 * @param totalJobs Total number of jobs on this page
 * @param searchUrl Base search URL
 * @param platformId Platform ID for job storage
 * @returns Processing result with job ID if saved
 */
export async function processJobCard(
  page: Page,
  searchJobData: SearchPageJob,
  jobNumber: number,
  totalJobs: number,
  searchUrl: string,
  platformId: string,
): Promise<JobProcessingResult> {
  const { clickableId } = searchJobData;
  const pseudoUrl = `${searchUrl}#spa-job-${jobNumber}`;

  // Visual separator for each job
  console.log(`\n   [${"─".repeat(56)}]`);
  console.log(`   Job ${jobNumber}/${totalJobs}`);
  console.log(`   [${"─".repeat(56)}]`);

  // Get element info before clicking for debugging
  const elementInfo = await getElementInfo(page, clickableId);

  // Log click info concisely
  const clickText = elementInfo.text || elementInfo.ariaLabel || "(no text)";
  console.log(`      👆 Clicking #${clickableId}: "${clickText}"`);

  // Click and wait for content to load
  await clickJobCard(page, clickableId);

  // Get full page HTML
  const jobHtml = await page.content();

  // Build search context to help LLM identify the correct job
  const searchContext: SearchContext = {
    title: searchJobData.title,
    company: searchJobData.company,
    location: searchJobData.location,
  };

  // Extract job data from page
  const detailJobData = await extractJobData(jobHtml, pseudoUrl, searchContext);

  // Merge search page data with detail page data
  const jobData = mergeJobData(searchJobData, detailJobData);

  // Skip if no meaningful data was extracted (invalid/expired page)
  if (!isValidJob(jobData)) {
    const reason = getJobInvalidReason(jobData);
    console.log(`      ⏭️  Skipping - ${reason}`);
    return {
      success: false,
      skipped: true,
      skipReason: reason,
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
  const result = await upsertJob(jobData, pseudoUrl, platformId);
  formatJobOutput(jobData, result, pseudoUrl);

  return {
    success: true,
    jobId: result.id,
    created: result.created,
    isClosed,
    isStale,
    title: jobData.title,
    company: jobData.job_poster,
    location: jobData.location,
    remote: jobData.remote,
    jobType: jobData.job_type,
    skills: jobData.skills,
  };
}
