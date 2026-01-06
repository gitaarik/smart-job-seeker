/**
 * URL-based scraper strategy
 * Traditional scraping: extract job URLs from search results, visit each job page, extract data
 */

import type { Page } from "patchright";
import { config } from "$lib/server/config";
import {
  detectLoginPage,
  extractJobData,
  extractJobLinks,
  normalizeJobUrl,
  upsertJob,
} from "$lib/server/job-scraper";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import { parseRelativeDate } from "$lib/tools/date-utils";
import {
  checkStopConditions,
  isFatalScraperError,
  isJobClosed,
  isJobTooOld,
} from "$lib/server/scrape-filters";
import { detectCaptchaOnPage } from "$lib/server/cdp-utils";
import {
  detectPaginationStrategy,
  navigateToNextPage,
  performInfiniteScroll,
} from "$lib/server/pagination-utils";
import {
  waitForCaptchaSolution,
  waitForLoginSolution,
} from "$lib/server/scraper-interactive";
import { dbDirect } from "$lib/db";
import { waitForJobContentToLoad } from "$lib/server/browser-utils";

/**
 * Check if job HTML has changed since last scrape
 * @param sourceUrl Job URL to check
 * @param newStrippedHtml New stripped HTML content
 * @param force If true, always return true (skip comparison)
 * @returns true if HTML changed or job is new
 */
async function hasHtmlChanged(
  sourceUrl: string,
  newStrippedHtml: string,
  force = false,
): Promise<boolean> {
  // If force flag is set, always consider HTML as changed
  if (force) {
    return true;
  }

  const normalizedUrl = normalizeJobUrl(sourceUrl);

  const existingJob = await dbDirect.jobs.findFirst({
    where: { source_url: normalizedUrl },
    select: { id: true, source_html_stripped: true },
  });

  // If job doesn't exist, HTML is "new"
  if (!existingJob) {
    return true;
  }

  // If no existing HTML stored, consider it changed
  if (!existingJob.source_html_stripped) {
    return true;
  }

  // Compare HTML content
  return existingJob.source_html_stripped !== newStrippedHtml;
}

/**
 * Scrape jobs using URL-based navigation with Playwright + LLM
 * Traditional scraping: extract job URLs from search results, visit each job page, extract data
 * @param page Playwright page instance
 * @param searchUrl Job search results URL
 * @param platformId Job platform ID
 * @param platformPaginationType Optional pagination type from platform config
 * @returns Number of jobs successfully processed
 */
export async function scrapeJobsWithUrls(
  page: Page,
  searchUrl: string,
  platformId: number,
  platformPaginationType?: string | null,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
  console.log("\n🔗 Starting URL-based scraping (traditional navigation)");

  // Track processing state
  const baseUrl = new URL(searchUrl);
  const seenJobUrls = new Set<string>(); // For deduplication (especially infinite scroll)
  let processedCount = 0;
  let consecutiveClosed = 0;
  let currentPage = 1;
  let savedStrippedHtml = ""; // Store stripped HTML from first page for debugging

  // Wait for page content to be fully loaded (important for SPAs)
  console.log("⏳ Waiting for page content to load...");
  await page.waitForTimeout(config.scraperPageLoadTimeout);

  while (currentPage <= config.scraperPaginationMaxPages) {
    console.log(`\n📄 Page ${currentPage}...`);

    const html = await page.content();
    const htmlSize = (html.length / 1024).toFixed(1);

    // Capture stripped HTML from first page for debugging
    if (currentPage === 1) {
      savedStrippedHtml = stripHtmlForLlm(html);
    }

    // Check for CAPTCHA before attempting extraction
    const hasCaptcha = await detectCaptchaOnPage(page);

    if (hasCaptcha) {
      const captchaSolved = await waitForCaptchaSolution(page);

      if (!captchaSolved) {
        console.log("⚠️  Skipping this search due to CAPTCHA timeout");
        break;
      }

      console.log("🔄 Reloading page after CAPTCHA solution...");
      await page.reload({ waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(config.scraperRateLimitDelay);
      continue;
    }

    // Check for login page BEFORE extracting job links
    console.log(`   Checking for login requirement...`);
    const isLoginPage = await detectLoginPage(html);

    if (isLoginPage) {
      console.log("   🔐 Login page detected");
      const loginCompleted = await waitForLoginSolution(page);

      if (!loginCompleted) {
        console.log("⚠️  Skipping this search due to login timeout");
        break;
      }

      console.log("🔄 Reloading page after login...");
      await page.reload({ waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(config.scraperRateLimitDelay);
      continue;
    }

    console.log(`   Extracting job links (${htmlSize} KB)...`);
    let pageUrls: string[];
    
    try {
      pageUrls = await extractJobLinks(html);
    } catch (error) {
      // extractJobLinks has its own login detection that might disagree with our LLM check
      // If it throws a login error, handle it here as a fallback
      if (
        error instanceof Error &&
        error.message.includes("Login/authentication page detected")
      ) {
        console.log("   ⚠️  extractJobLinks detected login (fallback check)");
        const loginCompleted = await waitForLoginSolution(page);

        if (!loginCompleted) {
          console.log("⚠️  Skipping this search due to login timeout");
          break;
        }

        console.log("🔄 Reloading page after login...");
        await page.reload({ waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(config.scraperRateLimitDelay);
        continue;
      }

      // Re-throw if it's a different error
      throw error;
    }

    if (!pageUrls || pageUrls.length === 0) {
      if (currentPage === 1) {
        console.log("   ⚠️  No job links found.");
        console.log("   Possible reasons:");
        console.log("   - Search returned no results (legitimate)");
        console.log("   - Page structure changed (update selectors)");
        console.log("   - Content still loading (increase timeout)");
      } else {
        console.log("   No jobs found, stopping pagination");
      }
      break;
    }

    // Convert relative URLs to absolute URLs
    pageUrls = pageUrls.map((url) => {
      if (url.startsWith("/")) {
        return `${baseUrl.origin}${url}`;
      }
      return url;
    });

    // Filter out already-seen jobs (for infinite scroll deduplication)
    const newJobUrls = pageUrls.filter((url) => !seenJobUrls.has(url));

    if (newJobUrls.length === 0) {
      console.log("   All jobs already seen, stopping");
      break;
    }

    console.log(
      `   Found ${pageUrls.length} job(s) (${newJobUrls.length} new)`,
    );

    // Process each new job immediately
    for (const jobUrl of newJobUrls) {
      seenJobUrls.add(jobUrl);

      // Check early exit conditions
      if (processedCount >= config.scraperMaxJobsPerSearch) {
        console.log(
          `\n✅ Reached max jobs limit (${config.scraperMaxJobsPerSearch})`,
        );
        return {
          jobsProcessed: processedCount,
          strippedHtml: savedStrippedHtml,
        };
      }

      if (consecutiveClosed >= config.scraperConsecutiveClosedLimit) {
        console.log(
          `\n⏹️  Too many consecutive closed jobs (${consecutiveClosed})`,
        );
        return {
          jobsProcessed: processedCount,
          strippedHtml: savedStrippedHtml,
        };
      }

      try {
        console.log(`\n   Processing: ${jobUrl}`);

        // Navigate to job page
        await page.goto(jobUrl, {
          waitUntil: "load",
          timeout: config.scraperDefaultTimeout,
        });

        // Wait for dynamic job content to load (e.g., LinkedIn's async-loaded descriptions)
        await waitForJobContentToLoad(page);

        const jobHtml = await page.content();
        const strippedHtml = stripHtmlForLlm(jobHtml);

        // Check if HTML changed (skip if unchanged and not forced)
        const htmlChanged = await hasHtmlChanged(jobUrl, strippedHtml, false);
        if (!htmlChanged) {
          console.log(`   ⏭️  Skipping - HTML unchanged`);
          continue;
        }

        // Extract job data
        console.log("   Extracting job data...");
        const jobData = await extractJobData(jobHtml, jobUrl);

        // Skip if no meaningful data was extracted (invalid/expired page)
        // Check if most critical fields are null/empty
        const hasTitle = jobData.title && jobData.title.trim() !== "";
        const hasDescription = jobData.job_description &&
          jobData.job_description.trim() !== "";
        const hasCompanyDesc = jobData.company_description &&
          jobData.company_description.trim() !== "";

        if (!hasTitle && !hasDescription && !hasCompanyDesc) {
          console.log(
            `   ⏭️  Skipping - Invalid/expired job page (no data extracted)`,
          );
          consecutiveClosed = 0; // Reset counter for invalid pages
          continue;
        }

        // Apply filters
        const datePosted = jobData.date_posted
          ? parseRelativeDate(jobData.date_posted)
          : null;

        if (isJobTooOld(datePosted, config.scraperMaxJobAge)) {
          console.log(
            `   ⏭️  Skipping - Posted ${datePosted?.toLocaleDateString()} (too old)`,
          );
          consecutiveClosed = 0; // Reset (not a closed job)
          continue;
        }

        if (isJobClosed(jobData.status)) {
          console.log(`   ⏭️  Skipping - Status: ${jobData.status}`);
          consecutiveClosed++;
          continue;
        }

        // Reset consecutive closed counter
        consecutiveClosed = 0;

        // Save job
        const result = await upsertJob(
          { ...jobData, date_posted: datePosted },
          jobUrl,
          platformId,
        );
        processedCount++;

        console.log(
          `   ✅ ${
            result.created ? "Created" : "Updated"
          } job #${result.id} (${processedCount} total)`,
        );

        // Delay to avoid rate limiting
        await page.waitForTimeout(config.scraperRateLimitDelay);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`   ✗ Failed to process ${jobUrl}:`, err.message);

        // Check if this is a fatal error that should stop all scraping
        if (isFatalScraperError(err)) {
          console.error(
            `\n🛑 Fatal error encountered - stopping scraper: ${err.message}`,
          );
          return {
            jobsProcessed: processedCount,
            strippedHtml: savedStrippedHtml,
          };
        }

        consecutiveClosed = 0; // Reset on error
      }
    }

    // Detect pagination/scroll
    const strippedHtml = stripHtmlForLlm(html);
    console.log("   Detecting pagination strategy...");
    const paginationInfo = await detectPaginationStrategy(
      page,
      strippedHtml,
      platformPaginationType,
    );
    console.log(
      `   Pagination info: type=${paginationInfo.paginationType}, ` +
        `hasPagination=${paginationInfo.hasPagination}, ` +
        `hasInfiniteScroll=${paginationInfo.hasInfiniteScroll}, ` +
        `nextButton=${paginationInfo.nextButtonSelector || "none"}, ` +
        `nextUrl=${paginationInfo.nextPageUrl || "none"}`,
    );

    if (!paginationInfo.hasPagination && !paginationInfo.hasInfiniteScroll) {
      console.log("   No pagination detected, stopping");
      break;
    }

    // Handle infinite scroll
    if (paginationInfo.hasInfiniteScroll && !paginationInfo.hasPagination) {
      console.log("   Infinite scroll detected, scrolling...");
      const newContent = await performInfiniteScroll(page, {
        maxScrolls: config.scraperInfiniteScrollMaxScrolls,
      });

      if (newContent === 0) {
        console.log("   No new content after scroll, stopping");
        break;
      }

      // Continue loop to re-extract after scroll
      continue;
    }

    // Navigate to next page (pagination)
    console.log("   Navigating to next page...");
    const hasNext = await navigateToNextPage(page, paginationInfo);
    console.log(`   Navigation result: ${hasNext ? "SUCCESS" : "FAILED"}`);

    if (!hasNext) {
      console.log("   No more pages available");
      break;
    }

    currentPage++;
    console.log(`   ✓ Now on page ${currentPage}`);
    await page.waitForTimeout(config.scraperRateLimitDelay); // Rate limiting
  }

  console.log(
    `\n✅ Processed ${processedCount} job(s) across ${currentPage} page(s)`,
  );
  return { jobsProcessed: processedCount, strippedHtml: savedStrippedHtml };
}
