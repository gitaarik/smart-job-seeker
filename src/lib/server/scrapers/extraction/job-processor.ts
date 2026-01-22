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
import { humanClick, humanWait } from "$lib/server/browser/stealth-utils";
import { markClickableElementsInContainer } from "$lib/server/browser/cdp-utils";
import {
  waitForContentChange,
  waitForSpaContent,
} from "$lib/server/utils/page-wait";
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
      // Don't truncate href - we need the full URL for navigation
      const href = el.getAttribute("href") || "";
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
 * Check if href is a valid navigable URL (not empty, not # fragment, not javascript:)
 */
function isNavigableHref(href: string): boolean {
  if (!href || href === "#" || href.startsWith("javascript:")) {
    return false;
  }
  return true;
}

/**
 * Result of clicking a job card, including navigation state
 */
interface ClickResult {
  contentChanged: boolean;
  /** The page to extract job details from (may be a new tab) */
  extractionPage: Page;
  /** If a new tab was opened, reference to close it later */
  newTab: Page | null;
  /** Whether navigation occurred (URL changed in same tab) */
  navigatedAway: boolean;
  /** Original URL to return to */
  originalUrl: string;
}

/**
 * Open a job in a new tab or click to view details
 *
 * For anchor elements with href: opens in new tab to preserve search page
 * For JS click handlers: clicks normally (SPA behavior)
 */
async function clickJobCard(
  page: Page,
  clickableId: number,
  href: string,
): Promise<ClickResult> {
  // Press Escape to clear any stray modals
  await page.keyboard.press("Escape").catch(() => {});

  const originalUrl = page.url();
  const context = page.context();
  let extractionPage: Page = page;
  let newTab: Page | null = null;
  let navigatedAway = false;

  // If element has a valid href, open in new tab to preserve search page
  if (isNavigableHref(href)) {
    // Resolve relative URLs
    const fullUrl = new URL(href, originalUrl).href;
    console.log(`      📑 Opening in new tab: ${fullUrl}`);

    // Open new tab and navigate
    newTab = await context.newPage();
    await newTab.goto(fullUrl, { waitUntil: "domcontentloaded" });
    await humanWait(newTab, 1000);
    extractionPage = newTab;
  } else {
    // No href - this is a JS click handler (SPA behavior)
    const beforeClick = await page.evaluate(
      () => document.body.innerText.length,
    );

    // Use human-like click
    const selector = `[data-extract-clickable-id="${clickableId}"]`;
    await humanClick(page, selector);

    // Brief initial wait for click handler to fire
    await humanWait(page, 500);

    // Check if a new tab was opened by the click
    const currentPages = context.pages();
    if (currentPages.length > 1) {
      // Find the new tab (not the original page)
      const possibleNewTab = currentPages.find((p) => p !== page);
      if (possibleNewTab) {
        newTab = possibleNewTab;
        extractionPage = newTab;
        console.log(`      📑 Click opened new tab`);
        await newTab.waitForLoadState("domcontentloaded");
        await humanWait(newTab, 1000);
      }
    }

    // Check if URL changed (navigation in same tab)
    if (!newTab && page.url() !== originalUrl) {
      navigatedAway = true;
      console.log(`      🔀 Navigated to: ${page.url()}`);
    }

    // Wait for SPA content to change and stabilize
    if (!newTab && !navigatedAway) {
      const changeResult = await waitForContentChange(page, beforeClick, {
        timeout: config.scraperClickWaitTimeout,
        changeThreshold: 100,
        stabilizeAfter: true,
      });

      if (!changeResult.changed) {
        // Highlight the element with red border for visual debugging
        const selector = `[data-extract-clickable-id="${clickableId}"]`;
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            (el as HTMLElement).style.border = "3px solid red";
            (el as HTMLElement).style.backgroundColor = "rgba(255,0,0,0.1)";
          }
        }, selector);

        // Log the element's HTML for debugging
        const elementHtml = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el?.outerHTML?.substring(0, 500) || "(element not found)";
        }, selector);

        console.warn(`      ⚠️  Page content didn't change after click`);
        console.warn(`      🔴 Element marked with red border on page`);
        console.warn(`      🔍 Clicked element HTML:\n${elementHtml}`);

        return {
          contentChanged: false,
          extractionPage,
          newTab,
          navigatedAway,
          originalUrl,
        };
      }

      // Re-check if URL changed during content stabilization (slow navigation)
      if (page.url() !== originalUrl) {
        navigatedAway = true;
        console.log(`      🔀 Navigated to: ${page.url()}`);
      }
    }
  }

  return {
    contentChanged: true,
    extractionPage,
    newTab,
    navigatedAway,
    originalUrl,
  };
}

/**
 * Return to the search page after extracting job details
 * Handles closing new tabs or navigating back
 */
async function returnToSearchPage(
  page: Page,
  clickResult: ClickResult,
): Promise<void> {
  const { newTab, navigatedAway, originalUrl } = clickResult;

  if (newTab) {
    // Close the new tab - original page is still intact
    console.log(`      🔙 Closing job tab, returning to search`);
    await newTab.close();
    return;
  }

  if (navigatedAway) {
    // Navigate back to search results
    console.log(`      🔙 Navigating back to search results`);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await humanWait(page, 1500);

    // Verify we're back on the search page
    const currentUrl = page.url();
    if (currentUrl !== originalUrl) {
      console.warn(
        `      ⚠️  Back navigation landed on different URL: ${currentUrl}`,
      );
      // Try to navigate directly to the search URL
      await page.goto(originalUrl, { waitUntil: "domcontentloaded" });
      await humanWait(page, 1500);
    }

    // Wait for content to stabilize before re-marking
    await waitForSpaContent(page, {
      maxAttempts: 3,
      pollInterval: 1000,
      minGrowthThreshold: 100,
    });

    // Re-mark clickable elements (DOM was re-rendered after navigation)
    await markClickableElementsInContainer(page, "body");
  }

  // SPA behavior - nothing to do, we're still on the search page
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

  // Open job details (new tab for anchors, click for SPAs)
  const clickResult = await clickJobCard(page, clickableId, elementInfo.href);
  const { extractionPage, navigatedAway, newTab, contentChanged } = clickResult;

  // Skip if click didn't change page content (element highlighted for debugging)
  if (!contentChanged) {
    return {
      success: false,
      skipped: true,
      skipReason: "Click did not change page content",
    };
  }

  // Use actual URL if we navigated, otherwise use pseudo URL for SPAs
  const jobSourceUrl = navigatedAway || newTab
    ? extractionPage.url()
    : pseudoUrl;

  try {
    // Get full page HTML from the appropriate page
    const jobHtml = await extractionPage.content();

    // Build search context to help LLM identify the correct job
    const searchContext: SearchContext = {
      title: searchJobData.title,
      company: searchJobData.company,
      location: searchJobData.location,
    };

    // Extract job data from page
    const detailJobData = await extractJobData(
      jobSearchId,
      jobHtml,
      jobSourceUrl,
      searchContext,
    );

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
        skipReason: reason,
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
    const result = await upsertJob(jobData, jobSourceUrl, platformId);
    formatJobOutput(jobData, result, jobSourceUrl);

    // Return to search page for the next job
    await returnToSearchPage(page, clickResult);

    return {
      success: true,
      jobId: result.id,
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
