/**
 * Click-based scraper strategy
 * SPA scraping: marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 */

import type { Page } from "patchright";
import { config } from "$lib/server/config";
import {
  extractJobData,
  extractJobsFromSearchPage,
  mergeJobData,
  upsertJob,
} from "$lib/server/job-scraper";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import {
  checkStopConditions,
  isFatalScraperError,
  isJobClosed,
  isJobTooOld,
} from "$lib/server/scrape-filters";
import { markClickableElementsInContainer } from "$lib/server/cdp-utils";
import {
  detectPaginationStrategy,
  navigateToNextPage,
  performInfiniteScroll,
} from "$lib/server/pagination-utils";
import { detectModalContent } from "$lib/server/scraper-interactive";
import { performPatchwrightLogin } from "../patchright-login";

/**
 * Scrape jobs using click-based navigation (SPAs)
 * Marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 * Extracts and saves jobs immediately during clicking for real-time feedback
 * @param page Patchright page instance
 * @param searchUrl URL of the search results page
 * @param platformId Platform ID for job storage
 * @param profileId Optional profile ID for credential-based login
 * @returns Object with jobsProcessed count and strippedHtml for debugging
 */
export async function scrapeJobsWithClicks(
  page: Page,
  searchUrl: string,
  platformId: string,
  profileId?: number,
): Promise<{ jobsProcessed: number; strippedHtml: string }> {
  console.log("\n🔄 Starting SPA scraping mode (click-based navigation)");

  // Attempt login if credentials provided
  if (profileId) {
    const loginSuccess = await performPatchwrightLogin(
      page,
      Number(platformId),
      profileId,
    );
    if (loginSuccess) {
      // Navigate back to search URL after successful login
      console.log(`🔙 Navigating back to search URL...`);
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } else {
      console.warn(
        "⚠️  Login failed, continuing with unauthenticated scraping",
      );
    }
  }

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
  let savedStrippedHtml = ""; // Store stripped HTML from first page for debugging
  let previousPageJobIds: number[] = []; // Track job IDs from previous page to detect duplicates

  // Pagination loop
  while (pageNumber <= config.scraperPaginationMaxPages) {
    console.log(`\n📄 Page ${pageNumber}...`);

    // Mark all clickable elements using CDP
    console.log("   📍 Step 1/3: Detecting click handlers via CDP...");
    const startCdp = Date.now();

    const clickableCount = await markClickableElementsInContainer(page, "body");

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

    // Strip HTML for LLM processing (data-extract-clickable-id attributes survive)
    const strippedHtml = stripHtmlForLlm(markedHtml);

    // Capture stripped HTML from first page BEFORE LLM extraction (so we save it even if LLM fails)
    if (pageNumber === 1) {
      savedStrippedHtml = strippedHtml;
    }

    // Always use LLM to extract jobs with titles (even when CDP detects job-detail buttons)
    console.log(
      "\n   🤖 Step 2/3: Asking LLM to extract job cards with titles...",
    );
    const startLlm = Date.now();

    let jobs: Array<
      {
        clickableId: number;
        title: string | null;
        company?: string | null;
        location?: string | null;
        salary_min?: number | null;
        salary_max?: number | null;
        salary_currency?: string | null;
        salary_period?: string | null;
      }
    >;

    try {
      const result = await extractJobsFromSearchPage(strippedHtml);
      jobs = result.jobs;

      const llmDuration = ((Date.now() - startLlm) / 1000).toFixed(2);
      console.log(`      ✓ LLM analysis complete (${llmDuration}s)`);
      console.log(`      Job cards found: ${jobs.length}`);
    } catch (error) {
      console.error(
        `      ❌ LLM extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      console.log(
        `      ℹ️  Returning stripped HTML for debugging (${savedStrippedHtml.length} chars)`,
      );
      // Return early with stripped HTML so it gets saved to database
      return {
        jobsProcessed: stats.jobsProcessed,
        strippedHtml: savedStrippedHtml,
      };
    }

    // If we detected job-detail buttons via CDP, prefer those IDs
    // (they are high-confidence clickable elements that open job details)
    if (jobDetailButtonIds.length > 0) {
      console.log(
        `      ℹ️  CDP detected ${jobDetailButtonIds.length} job-detail buttons`,
      );

      if (jobs.length === 0) {
        // Fallback: use CDP IDs directly if LLM extraction failed
        console.log(
          "      ⚠️  LLM found 0 jobs, falling back to CDP-detected buttons",
        );
        jobs = jobDetailButtonIds.map((id) => ({
          clickableId: id,
          title: null,
        }));
      } else {
        // Filter LLM jobs to only include CDP-detected job-detail-button IDs
        // This prevents clicking on non-job elements (navigation, logos, etc.)
        const jobDetailButtonIdSet = new Set(jobDetailButtonIds);
        const filteredJobs = jobs.filter((j) =>
          jobDetailButtonIdSet.has(j.clickableId)
        );

        if (filteredJobs.length > 0) {
          const droppedCount = jobs.length - filteredJobs.length;
          if (droppedCount > 0) {
            console.log(
              `      🎯 Filtered to ${filteredJobs.length} jobs with job-detail-button IDs (dropped ${droppedCount} non-job elements)`,
            );
          }
          jobs = filteredJobs;
        } else {
          // LLM IDs don't match any job-detail-buttons - use CDP IDs with LLM titles if possible
          console.log(
            "      ⚠️  LLM IDs don't match job-detail buttons, using CDP IDs",
          );
          jobs = jobDetailButtonIds.map((id) => {
            // Try to find a title from LLM results for context (even if ID didn't match)
            const llmJob = jobs.find((j) => j.title && j.title.length > 0);
            return {
              clickableId: id,
              title: null, // Can't reliably map titles when IDs don't match
            };
          });
        }
      }
    }

    console.log(
      `      Jobs: [${
        jobs.map((j) => `${j.clickableId}:${j.title || "?"}`).join(", ")
      }]`,
    );

    // Detect duplicate pages (SPA pagination false positives)
    if (pageNumber > 1 && previousPageJobIds.length > 0) {
      const currentJobIds = jobs.map((j) => j.clickableId);
      const duplicateCount = currentJobIds.filter((id) =>
        previousPageJobIds.includes(id)
      ).length;
      const duplicatePercentage = (duplicateCount / currentJobIds.length) *
        100;

      if (duplicatePercentage > 80) {
        console.log(
          `\n   ⏭️  Stopping: ${
            duplicatePercentage.toFixed(0)
          }% duplicate jobs (${duplicateCount}/${currentJobIds.length})`,
        );
        console.log(
          "   This page has the same jobs as the previous page (SPA pagination artifact)",
        );
        break;
      }
    }

    // Store current page job IDs for next iteration
    previousPageJobIds = jobs.map((j) => j.clickableId);

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

    if (isLoginPage && jobs.length < 5) {
      console.log(
        "\n   🚫 Login/signup page detected - stopping scrape",
      );
      console.log(
        `   Reason: hasLoginForm=${hasLoginForm}, hasLoginKeywords=${hasLoginKeywords}, jobs=${jobs.length}`,
      );
      console.log(
        "   💡 Please log in manually in the browser and run the scraper again",
      );
      break;
    }

    if (jobs.length === 0) {
      console.log("      ⚠️  No job cards found in the page");
      break;
    }

    // Click each identified job card and process immediately
    console.log(
      `\n   👆 Step 3/3: Clicking and processing ${jobs.length} job cards...\n`,
    );
    for (let i = 0; i < jobs.length; i++) {
      const searchJobData = jobs[i];
      const { clickableId } = searchJobData;
      const jobNumber = i + 1;
      const pseudoUrl = `${searchUrl}#spa-job-${jobNumber}`;

      // Visual separator for each job
      console.log(`\n   [${"─".repeat(56)}]`);
      console.log(`   Job ${jobNumber}/${jobs.length}`);
      console.log(`   [${"─".repeat(56)}]`);

      // Log search page data if available
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
          searchJobData.salary_period
            ? `per ${searchJobData.salary_period}`
            : "",
        ].filter(Boolean).join(" ");
        console.log(`      💰 Salary: ${salaryStr}`);
      }

      try {
        // Use Patchright direct clicking
        console.log(
          `      👆 Clicking data-extract-clickable-id="${clickableId}"...`,
        );

        // Close any open modals first
        await page.locator('[class*="close"]').first().click().catch(
          () => {},
        );
        await page.locator('[aria-label*="close" i]').first().click().catch(
          () => {},
        );
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(config.scraperModalWaitTimeout);

        // Capture page state before click for comparison
        const beforeClick = await page.evaluate(() =>
          document.body.innerText.length
        );

        await page.locator(`[data-extract-clickable-id="${clickableId}"]`)
          .click();

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

        // Extract job data from detail page
        console.log(`      🔍 Extracting job data from detail page...`);
        const detailJobData = await extractJobData(strippedHtml, pseudoUrl);

        // Merge search page data with detail page data
        const jobData = mergeJobData(searchJobData, detailJobData);

        // Log final merged job data
        console.log(`      📋 Final job data:`);
        console.log(`         Title: ${jobData.title || "(none)"}`);
        if (jobData.job_poster) {
          console.log(`         Company: ${jobData.job_poster}`);
        }
        if (jobData.location) {
          console.log(`         Location: ${jobData.location}`);
        }
        if (jobData.remote) console.log(`         Remote: ${jobData.remote}`);
        if (jobData.job_type) console.log(`         Type: ${jobData.job_type}`);
        if (jobData.experience_level) {
          console.log(`         Level: ${jobData.experience_level}`);
        }
        if (jobData.skills?.length) {
          console.log(`         Skills: ${jobData.skills.join(", ")}`);
        }
        if (jobData.job_description) {
          console.log(
            `         Description: ${
              jobData.job_description.substring(0, 80)
            }...`,
          );
        }

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
            return {
              jobsProcessed: stats.jobsProcessed,
              strippedHtml: savedStrippedHtml,
            };
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
          return {
            jobsProcessed: stats.jobsProcessed,
            strippedHtml: savedStrippedHtml,
          };
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
          return {
            jobsProcessed: stats.jobsProcessed,
            strippedHtml: savedStrippedHtml,
          };
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
  return {
    jobsProcessed: stats.jobsProcessed,
    strippedHtml: savedStrippedHtml,
  };
}
