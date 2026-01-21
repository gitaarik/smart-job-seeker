/**
 * Single job card processing: click, extract, validate, and save
 */

import type { Page } from "playwright";
import { config } from "$lib/server/config";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import {
  getJobInvalidReason,
  isJobClosed,
  isJobTooOld,
  isValidJob,
} from "$lib/server/scrape-filters";
import { humanClick, humanWait } from "$lib/server/stealth-utils";
import { upsertJob } from "../job-data";
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
 * Log search page data if available
 */
function logSearchData(searchJobData: SearchPageJob): void {
  if (searchJobData.title) {
    console.log(`      📋 Title: "${searchJobData.title}"`);
  }
  if (searchJobData.company) {
    console.log(`      🏢 Company: "${searchJobData.company}"`);
  }
  if (searchJobData.location) {
    console.log(`      📍 Location: "${searchJobData.location}"`);
  }
  if (searchJobData.salary_min || searchJobData.salary_max) {
    const salaryStr = [
      searchJobData.salary_currency || "",
      searchJobData.salary_min?.toLocaleString() || "",
      searchJobData.salary_max
        ? `-${searchJobData.salary_max.toLocaleString()}`
        : "",
      searchJobData.salary_period ? `per ${searchJobData.salary_period}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    console.log(`      💰 Salary: ${salaryStr}`);
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

  // Log search page data
  logSearchData(searchJobData);

  // Get element info before clicking for debugging
  const elementInfo = await getElementInfo(page, clickableId);

  // Log what element we're clicking
  const elementDesc = [
    `<${elementInfo.tag}>`,
    elementInfo.text ? `"${elementInfo.text}"` : "",
    elementInfo.href ? `href="${elementInfo.href}..."` : "",
    elementInfo.ariaLabel ? `aria-label="${elementInfo.ariaLabel}"` : "",
    `</${elementInfo.tag}>`,
  ]
    .filter(Boolean)
    .join(" ");
  console.log(`      👆 Clicking #${clickableId}: ${elementDesc}`);

  // Click and wait for content to load
  await clickJobCard(page, clickableId);

  // Get full page HTML
  const jobHtml = await page.content();
  console.log(`      ✓ Captured page HTML (${jobHtml.length} chars)`);

  // Debug: Log first 500 chars of stripped HTML
  if (config.scraperDebugMode) {
    const preview = stripHtmlForLlm(jobHtml).substring(0, 500);
    console.log(`      [DEBUG] HTML preview: ${preview}...`);
  }

  // Build search context to help LLM identify the correct job
  const searchContext: SearchContext = {
    title: searchJobData.title,
    company: searchJobData.company,
    location: searchJobData.location,
  };

  // Extract job data from page
  console.log(
    `      🔍 Extracting job data (context: ${
      searchJobData.title || "unknown"
    } @ ${searchJobData.company || "unknown"})...`,
  );
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
    console.log(
      `      📅 Old job (${jobData.date_posted?.toLocaleDateString()}) - importing as 'stale'`,
    );
    jobData.status = "stale";
    isStale = true;
  }

  // Status check: Track closed jobs
  const isClosed = isJobClosed(jobData.status);
  if (isClosed) {
    console.log(`      📋 Closed job (${jobData.status}) - importing`);
  }

  // Save job
  console.log(`      💾 Saving to database...`);
  const result = await upsertJob(jobData, pseudoUrl, platformId);

  const action = result.created ? "Created" : "Updated";
  console.log(`      ✅ ${action} job #${result.id}`);
  console.log(`      🔗 ${getDirectusJobUrl(result.id)}`);

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
