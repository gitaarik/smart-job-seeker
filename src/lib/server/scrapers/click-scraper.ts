/**
 * Click-based scraper strategy
 * SPA scraping: marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 */

import type { Page } from "playwright";
import { config } from "$lib/server/config";
import {
  extractJobClickSelectors,
  extractJobData,
  upsertJob,
} from "$lib/server/job-scraper";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import {
  checkStopConditions,
  isFatalScraperError,
  isJobClosed,
  isJobTooOld,
} from "$lib/server/scrape-filters";
import {
  markClickableElementsInContainer,
  markSemanticElements,
} from "$lib/server/cdp-utils";
import {
  detectPaginationStrategy,
  navigateToNextPage,
  performInfiniteScroll,
} from "$lib/server/pagination-utils";
import { detectModalContent } from "$lib/server/scraper-interactive";
import type { getSiteConfig } from "$lib/server/job-site-configs";

/**
 * Scrape jobs using click-based navigation (SPAs)
 * Marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 * Extracts and saves jobs immediately during clicking for real-time feedback
 * @returns Number of successfully processed jobs
 */
export async function scrapeJobsWithClicks(
  page: Page,
  siteConfig: ReturnType<typeof getSiteConfig>,
  searchUrl: string,
  platformId: string,
): Promise<number> {
  console.log("\n🔄 Starting SPA scraping mode (click-based navigation)");

  // Wait for page to fully render (SPAs need time)
  console.log("⏳ Waiting for SPA to fully render...");
  await page.waitForTimeout(3000);
  console.log(`📍 Current URL: ${page.url()}`);

  // Initialize stats
  const stats = {
    jobsProcessed: 0,
    consecutiveClosedJobs: 0,
    jobsSkippedOld: 0,
    jobsSkippedClosed: 0,
  };

  let pageNumber = 1;

  // Pagination loop
  while (pageNumber <= config.scraperPaginationMaxPages) {
    console.log(`\n📄 Page ${pageNumber}...`);

    // Mark all clickable elements using CDP
    console.log("   📍 Step 1/3: Detecting click handlers via CDP...");
    const container = siteConfig.selectors.jobListContainer || "body";
    console.log(`      Scanning container: ${container}`);
    const startCdp = Date.now();

    const clickableCount = await markClickableElementsInContainer(
      page,
      container,
    );

    const cdpDuration = ((Date.now() - startCdp) / 1000).toFixed(2);
    console.log(
      `      ✓ Found ${clickableCount} elements with click listeners (${cdpDuration}s)`,
    );

    if (clickableCount === 0) {
      console.log(
        "      ⚠️  No clickable elements found - page may not be loaded",
      );
      break;
    }

    // Get marked HTML
    const markedHtml = await page.content();
    const htmlSize = (markedHtml.length / 1024).toFixed(1);
    console.log(`      HTML size: ${htmlSize} KB`);

    // Check if we have job-detail-button markers (high-confidence job buttons)
    const jobDetailButtonMatches = markedHtml.matchAll(
      /data-extract-clickable-id="(\d+)" data-extract-click-text="job-detail-button"/g,
    );
    const jobDetailButtonIds = Array.from(jobDetailButtonMatches).map((
      match,
    ) => parseInt(match[1]));

    let clickableIds: number[];
    let pattern: string;
    let jobCount: number;

    if (jobDetailButtonIds.length > 0) {
      // We found job-detail buttons - use them directly without LLM validation
      console.log("\n   ✓ Step 2/3: Using detected job-detail buttons...");
      clickableIds = jobDetailButtonIds;
      pattern = "job-detail buttons detected by CDP";
      jobCount = jobDetailButtonIds.length;
      console.log(
        `      Found ${jobCount} job-detail buttons: [${
          clickableIds.join(", ")
        }]`,
      );
    } else {
      // No job-detail buttons found - fall back to LLM analysis
      console.log(
        "\n   🤖 Step 2/3: Asking LLM to identify job card pattern...",
      );
      const startLlm = Date.now();

      const result = await extractJobClickSelectors(markedHtml);
      clickableIds = result.clickableIds;
      pattern = result.pattern;
      jobCount = result.jobCount;

      const llmDuration = ((Date.now() - startLlm) / 1000).toFixed(2);
      console.log(`      ✓ LLM analysis complete (${llmDuration}s)`);
      console.log(`      Pattern: ${pattern}`);
      console.log(`      Job cards found: ${jobCount}`);
      console.log(`      Clickable IDs: [${clickableIds.join(", ")}]`);
    }

    // Check for login/signup page
    const pageText = await page.textContent("body") || "";
    const lowerText = pageText.toLowerCase();

    // More specific login detection: look for login forms, not just text
    const hasLoginForm = await page.locator('form[action*="login"]').count() >
        0 ||
      await page.locator('input[type="password"]').count() > 0;

    const hasLoginKeywords = lowerText.includes("sign in to continue") ||
      lowerText.includes("log in to continue") ||
      lowerText.includes("create an account") ||
      (lowerText.includes("email") && lowerText.includes("password") &&
        lowerText.includes("submit"));

    const isLoginPage = hasLoginForm || hasLoginKeywords;

    if (isLoginPage && clickableIds.length < 5) {
      console.log(
        "\n   🚫 Login/signup page detected - stopping scrape",
      );
      console.log(
        `   Reason: hasLoginForm=${hasLoginForm}, hasLoginKeywords=${hasLoginKeywords}, clickableIds=${clickableIds.length}`,
      );
      console.log(
        "   💡 Please log in manually in the browser and run the scraper again",
      );
      break;
    }

    if (clickableIds.length === 0) {
      console.log("      ⚠️  No job cards found in the page");
      break;
    }

    // Click each identified job card and process immediately
    console.log(
      `\n   👆 Step 3/3: Clicking and processing ${clickableIds.length} job cards...\n`,
    );
    for (let i = 0; i < clickableIds.length; i++) {
      const id = clickableIds[i];
      const jobNumber = i + 1;
      const pseudoUrl = `${searchUrl}#spa-job-${jobNumber}`;

      // Visual separator for each job
      console.log(`\n   [${"─".repeat(56)}]`);
      console.log(`   Job ${jobNumber}/${clickableIds.length}`);
      console.log(`   [${"─".repeat(56)}]`);

      // Extract context from search page before clicking
      let searchPageTitle: string | null = null;
      try {
        const clickableElement = page.locator(
          `[data-extract-clickable-id="${id}"]`,
        ).first();
        const elementText = await clickableElement.textContent({
          timeout: 2000,
        });

        if (elementText) {
          // Extract first non-empty line as title (simple heuristic)
          const lines = elementText.trim().split("\n").map((l) => l.trim())
            .filter((l) => l.length > 0);
          searchPageTitle = lines[0] || null;

          if (searchPageTitle) {
            console.log(
              `      📋 Search page title: "${
                searchPageTitle.substring(
                  0,
                  60,
                )
              }${searchPageTitle.length > 60 ? "..." : ""}"`,
            );
          }
        }
      } catch (error) {
        console.debug(
          `      ⚠️  Could not extract search page title:`,
          error instanceof Error ? error.message : String(error),
        );
        // Continue without fallback title - not a critical error
      }

      try {
        console.log(
          `      👆 Clicking data-extract-clickable-id="${id}"...`,
        );

        // Close any open modals first (SPAs often have close buttons or backdrop clicks)
        // Try common modal close patterns
        await page.locator('[class*="close"]').first().click().catch(() => {});
        await page.locator('[aria-label*="close" i]').first().click().catch(
          () => {},
        );
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(config.scraperModalWaitTimeout);

        // Capture page state before click for comparison
        const beforeClick = await page.evaluate(() =>
          document.body.innerText.length
        );

        await page.locator(`[data-extract-clickable-id="${id}"]`).click();

        // Wait for SPA to update - look for common modal/dialog/panel containers
        // This is a generic approach that works across different SPA frameworks
        await page.waitForTimeout(config.scraperClickWaitTimeout);

        // Check if page content changed after click
        const afterClick = await page.evaluate(() =>
          document.body.innerText.length
        );
        const contentChanged = Math.abs(afterClick - beforeClick) > 100;

        if (!contentChanged) {
          console.warn(
            `      ⚠️  Page content didn't change after click (before: ${beforeClick}, after: ${afterClick})`,
          );
        }

        // Try to find a modal/dialog/panel that appeared after the click
        const { modalContent, modalSelector } = await detectModalContent(page);

        // Mark semantic elements in modal if configured
        if (modalContent && siteConfig.semanticSelectors?.modal) {
          console.log("      🏷️  Marking semantic elements in modal...");
          const markResult = await markSemanticElements(
            page,
            siteConfig.semanticSelectors.modal,
          );
          console.log(`      Marked ${markResult.total} elements`);
        }

        // If we found modal content, use it; otherwise fall back to full page
        const jobHtml = modalContent
          ? `<div class="job-detail-modal">${modalContent}</div>`
          : await page.content();

        if (!modalContent) {
          console.warn(
            "      ⚠️  No modal found, using full page HTML (may extract wrong job)",
          );
        }

        // Log captured HTML size
        console.log(`      ✓ Captured job HTML (${jobHtml.length} chars)`);

        // Debug: Log first 500 chars of captured HTML
        if (config.scraperDebugMode) {
          const preview = stripHtmlForLlm(jobHtml).substring(0, 500);
          console.log(`      [DEBUG] HTML preview: ${preview}...`);
        }

        // Strip HTML for LLM processing
        const strippedHtml = stripHtmlForLlm(jobHtml);

        // Extract job data
        console.log(`      🔍 Extracting job data...`);
        const jobData = await extractJobData(strippedHtml, pseudoUrl, {
          fallbackTitle: searchPageTitle,
        });

        // Skip if no meaningful data was extracted (invalid/expired page)
        // Check if critical fields are null/empty
        const hasTitle = jobData.title && jobData.title.trim() !== "";
        const hasCompany = jobData.company && jobData.company.trim() !== "";
        const hasDescription = jobData.job_description &&
          jobData.job_description.trim() !== "";

        // If we don't have at least a title OR company, it's probably not a real job
        if (!hasTitle && !hasCompany) {
          console.log(
            `      ⏭️  Skipping - No title or company (likely login/error page)`,
          );
          stats.consecutiveClosedJobs = 0; // Reset counter for invalid pages
          continue;
        }

        // If we have neither title nor description, also skip
        if (!hasTitle && !hasDescription) {
          console.log(
            `      ⏭️  Skipping - No title or description (incomplete data)`,
          );
          stats.consecutiveClosedJobs = 0;
          continue;
        }

        // Age filter
        if (isJobTooOld(jobData.date_posted, config.scraperMaxJobAge)) {
          console.log(
            `      ⏭️  Skipping - Posted ${jobData.date_posted?.toLocaleDateString()} (too old)`,
          );
          stats.jobsSkippedOld++;
          stats.consecutiveClosedJobs = 0; // Reset (not a closed job)
          continue;
        }

        // Status filter
        const isClosed = isJobClosed(jobData.status);
        if (isClosed) {
          console.log(`      ⏭️  Skipping - Status: ${jobData.status}`);
          stats.jobsSkippedClosed++;
          stats.consecutiveClosedJobs++;

          // Check stop condition
          const stopCheck = checkStopConditions(stats, {
            maxJobsPerSearch: config.scraperMaxJobsPerSearch,
            consecutiveClosedLimit: config.scraperConsecutiveClosedLimit,
          });
          if (stopCheck.shouldStop) {
            console.log(`\n      🛑 ${stopCheck.reason}`);
            return stats.jobsProcessed;
          }
          continue;
        }

        // Reset consecutive closed counter
        stats.consecutiveClosedJobs = 0;

        // Save job
        console.log(`      💾 Saving to database...`);
        const result = await upsertJob(jobData, pseudoUrl, platformId);

        const action = result.created ? "Created" : "Updated";
        console.log(`      ✅ ${action} job #${result.id}`);

        stats.jobsProcessed++;

        // Check hard limit
        const stopCheck = checkStopConditions(stats, {
          maxJobsPerSearch: config.scraperMaxJobsPerSearch,
          consecutiveClosedLimit: config.scraperConsecutiveClosedLimit,
        });
        if (stopCheck.shouldStop) {
          console.log(`\n      🛑 ${stopCheck.reason}`);
          return stats.jobsProcessed;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(
          `      ❌ Error processing job ${jobNumber}:`,
          err.message,
        );

        // Check if this is a fatal error that should stop all scraping
        if (isFatalScraperError(err)) {
          console.error(
            `\n🛑 Fatal error encountered - stopping scraper: ${err.message}`,
          );
          return stats.jobsProcessed;
        }

        stats.consecutiveClosedJobs = 0; // Reset on error
        // Continue to next job - don't break entire scrape
      }
    }

    // After processing all jobs on current page, try to load more
    console.log("\n   🔍 Checking for more pages...");
    const paginationInfo = await detectPaginationStrategy(page);

    if (paginationInfo.hasInfiniteScroll || paginationInfo.loadMoreSelector) {
      console.log("      Infinite scroll detected, scrolling...");
      const newContent = await performInfiniteScroll(page, {
        maxScrolls: config.scraperInfiniteScrollMaxScrolls,
      });

      if (newContent === 0) {
        console.log("      No new content after scroll, stopping");
        break;
      }

      // Continue to next iteration to re-detect clickables after scroll
    } else if (paginationInfo.hasPagination) {
      console.log("      Pagination detected, navigating to next page...");
      const hasNext = await navigateToNextPage(page, paginationInfo);

      if (!hasNext) {
        console.log("      No more pages");
        break;
      }

      await page.waitForTimeout(config.scraperRateLimitDelay); // Rate limiting
    } else {
      console.log("      No pagination detected, stopping");
      break;
    }

    pageNumber++;
  }

  // Final stats
  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅ SPA scraping complete:`);
  console.log(`   Jobs saved: ${stats.jobsProcessed}`);
  console.log(`   Skipped (old): ${stats.jobsSkippedOld}`);
  console.log(`   Skipped (closed): ${stats.jobsSkippedClosed}`);
  console.log(`${"═".repeat(60)}\n`);
  return stats.jobsProcessed;
}
