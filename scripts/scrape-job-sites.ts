#!/usr/bin/env node

/**
 * Job site scraping script
 * Uses Browser-Use to scrape job listings and extract data
 */

import { dbDirect } from "$lib/db";
import {
  extractJobClickSelectors,
  extractJobData,
  extractJobLinks,
  getPlatformIdFromUrl,
  normalizeJobUrl,
  upsertJob,
} from "$lib/server/job-scraper";
import { Command } from "commander";
import { getSiteConfig, getSiteName } from "$lib/server/job-site-configs";
import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser-use-client";
import { parseRelativeDate } from "$lib/tools/date-utils";
import {
  checkStopConditions,
  isJobClosed,
  isJobTooOld,
} from "$lib/server/scrape-filters";
import { interpolatePrompt } from "$lib/server/ai-chat-utils";
import { clearDirectusCache } from "$lib/server/directus";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import {
  detectCaptchaOnPage,
  markClickableElementsInContainer,
  markSemanticElements,
} from "$lib/server/cdp-utils";
import {
  detectPaginationStrategy,
  navigateToNextPage,
  performInfiniteScroll,
} from "$lib/server/pagination-utils";
import { launchBrowser } from "$lib/server/browser-utils";
import type { Page } from "playwright";

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

/**
 * Common modal/dialog/panel selectors used across various UI frameworks
 * Ordered by specificity (more specific selectors first)
 */
const MODAL_SELECTORS = [
  '[role="dialog"]', // ARIA standard
  '[role="alertdialog"]',
  ".modal", // Bootstrap
  ".modal-content",
  ".ant-modal", // Ant Design
  ".MuiDialog-root", // Material-UI
  ".dialog", // Generic
  '[class*="modal"]', // Any class containing "modal"
  '[class*="dialog"]',
  '[class*="drawer"]',
  '[class*="panel"][class*="detail"]',
] as const;

/**
 * Detect and extract modal content after clicking a job card
 * @returns Object with modalContent (HTML string) and modalSelector (CSS selector used)
 */
async function detectModalContent(
  page: Page,
): Promise<{ modalContent: string | null; modalSelector: string | null }> {
  let modalContent = null;
  let modalSelector = null;

  // Try each selector to find the modal
  for (const selector of MODAL_SELECTORS) {
    const modal = page.locator(selector).first();
    if (await modal.isVisible().catch(() => false)) {
      // Wait for modal to have substantial content (retry for up to 3 seconds)
      let attempts = 0;
      while (attempts < 6) {
        modalContent = await modal.innerHTML().catch(() => null);
        if (modalContent && modalContent.length > 1000) {
          // Check if this is a navigation/menu drawer (not job details)
          const lowerContent = modalContent.toLowerCase();
          const isNavDrawer = lowerContent.includes("dashboard") &&
            (lowerContent.includes("log out") ||
              lowerContent.includes("logout") ||
              lowerContent.includes("settings"));

          if (isNavDrawer) {
            console.log(
              `      ⚠️  Skipping navigation drawer (${selector})`,
            );
            modalContent = null; // Reset to keep looking
            break;
          }

          // Found substantial non-nav modal content
          modalSelector = selector;
          console.log(
            `      ✓ Found modal: ${selector} (${
              (modalContent.length / 1024).toFixed(1)
            } KB)`,
          );
          break;
        }
        await page.waitForTimeout(config.scraperModalWaitTimeout);
        attempts++;
      }

      if (modalContent && modalContent.length > 1000) {
        break;
      }
    }
  }

  return { modalContent, modalSelector };
}

/**
 * Parse Browser-Use response with multiple fallback strategies
 * Tries direct parsing, regex extraction, and JSON repair
 */
function parseBrowserUseResponse(result: any): any[] {
  // Strategy 1: Already an array (direct response)
  if (Array.isArray(result)) {
    return result;
  }

  // Strategy 2: Already parsed object with jobs property
  if (typeof result === "object" && result !== null) {
    if (Array.isArray(result.jobs)) {
      return result.jobs;
    }
    if (Array.isArray(result.data)) {
      return result.data;
    }
  }

  // Strategy 3: String that needs parsing
  const resultStr = typeof result === "string"
    ? result
    : JSON.stringify(result);

  // Strategy 3a: Try direct JSON parse
  try {
    const parsed = JSON.parse(resultStr);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.jobs && Array.isArray(parsed.jobs)) {
      return parsed.jobs;
    }
    if (parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }
  } catch {
    // Continue to regex extraction
  }

  // Strategy 3b: Extract JSON array using regex
  const jsonArrayMatch = resultStr.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    try {
      const parsed = JSON.parse(jsonArrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      throw new Error(
        `Found JSON array pattern but failed to parse: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // Strategy 3c: Extract JSON object with jobs property
  const jsonObjectMatch = resultStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      const parsed = JSON.parse(jsonObjectMatch[0]);
      if (Array.isArray(parsed.jobs)) {
        return parsed.jobs;
      }
      if (Array.isArray(parsed.data)) {
        return parsed.data;
      }
    } catch {
      // Continue to error
    }
  }

  // All strategies failed
  throw new Error(
    `Could not extract job array from Browser-Use response. Response type: ${typeof result}, ` +
      `preview: ${resultStr.substring(0, 200)}...`,
  );
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

  // Parse the JSON result with multiple fallback strategies
  let jobs: any[];
  try {
    jobs = parseBrowserUseResponse(response.result);
  } catch (error) {
    console.error("❌ Failed to parse Browser-Use response:", error);
    console.log("Raw response:", JSON.stringify(response.result).substring(0, 500));
    throw error;
  }

  // Validate job structure
  if (!Array.isArray(jobs)) {
    throw new Error(
      `Browser-Use response is not an array, got: ${typeof jobs}`,
    );
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
 * Wait for user to manually solve CAPTCHA
 * @param page Playwright page with CAPTCHA challenge
 * @returns true if solved, false if timeout
 */
async function waitForCaptchaSolution(page: Page): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("🤖 CAPTCHA Challenge Detected");
  console.log("=".repeat(60));
  console.log("Please solve the CAPTCHA in the browser window.");
  console.log("You have 5 minutes to complete the challenge.");
  console.log("The script will automatically continue once solved.");
  console.log("=".repeat(60) + "\n");

  const timeoutMs = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  const checkInterval = config.scraperCaptchaCheckInterval;

  // Wait for CAPTCHA to be solved (check every 3 seconds, max 5 minutes)
  while (Date.now() - startTime < timeoutMs) {
    const remainingSeconds = Math.floor(
      (timeoutMs - (Date.now() - startTime)) / 1000,
    );
    console.log(
      `⏱️  Waiting for CAPTCHA solution... (${remainingSeconds}s remaining)`,
    );

    // Check if any CAPTCHA elements are still visible
    const hasCaptcha = await detectCaptchaOnPage(page);

    if (!hasCaptcha) {
      console.log("✅ CAPTCHA solved! Continuing...\n");
      // Wait a moment for page to fully update after CAPTCHA
      await page.waitForTimeout(config.scraperRateLimitDelay);
      return true;
    }

    await page.waitForTimeout(checkInterval);
  }

  console.log("❌ CAPTCHA timeout (5 minutes elapsed)");
  return false;
}

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
 * @returns Number of jobs successfully processed
 */
async function scrapeJobsWithUrls(
  page: Page,
  searchUrl: string,
  platformId: number,
): Promise<number> {
  console.log("\n🔗 Starting URL-based scraping (traditional navigation)");

  // Track processing state
  const baseUrl = new URL(searchUrl);
  const seenJobUrls = new Set<string>(); // For deduplication (especially infinite scroll)
  let processedCount = 0;
  let consecutiveClosed = 0;
  let currentPage = 1;

  // Wait for page content to be fully loaded (important for SPAs)
  console.log("⏳ Waiting for page content to load...");
  await page.waitForTimeout(config.scraperPageLoadTimeout);

  while (currentPage <= config.scraperPaginationMaxPages) {
    console.log(`\n📄 Page ${currentPage}...`);

    const html = await page.content();
    const htmlSize = (html.length / 1024).toFixed(1);

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

    console.log(`   Extracting job links (${htmlSize} KB)...`);
    let pageUrls = await extractJobLinks(html);

    if (!pageUrls || pageUrls.length === 0) {
      if (currentPage === 1) {
        console.log("   ⚠️  No job links found.");

        const hasLoginForm = await page.locator('form[action*="login"]')
          .isVisible().catch(() => false);

        if (hasLoginForm) {
          console.log("   Reason: Login page detected");
          console.log(
            "   Action: Run script again and complete login when prompted",
          );
        } else {
          console.log("   Possible reasons:");
          console.log("   - Search returned no results (legitimate)");
          console.log("   - Page structure changed (update selectors)");
          console.log("   - Content still loading (increase timeout)");
        }
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
        return processedCount;
      }

      if (consecutiveClosed >= config.scraperConsecutiveClosedLimit) {
        console.log(
          `\n⏹️  Too many consecutive closed jobs (${consecutiveClosed})`,
        );
        return processedCount;
      }

      try {
        console.log(`\n   Processing: ${jobUrl}`);

        // Navigate to job page
        await page.goto(jobUrl, {
          waitUntil: "load",
          timeout: config.scraperDefaultTimeout,
        });

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
        console.error(
          `   ✗ Failed to process ${jobUrl}:`,
          error instanceof Error ? error.message : String(error),
        );
        consecutiveClosed = 0; // Reset on error
      }
    }

    // Detect pagination/scroll
    const strippedHtml = stripHtmlForLlm(html);
    const paginationInfo = await detectPaginationStrategy(page, strippedHtml);

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

    if (!hasNext) {
      console.log("   No more pages available");
      break;
    }

    currentPage++;
    await page.waitForTimeout(config.scraperRateLimitDelay); // Rate limiting
  }

  console.log(
    `\n✅ Processed ${processedCount} job(s) across ${currentPage} page(s)`,
  );
  return processedCount;
}

/**
 * Scrape jobs using click-based navigation (SPAs)
 * Marks clickable elements with CDP, uses LLM to identify job cards, then clicks each
 * Extracts and saves jobs immediately during clicking for real-time feedback
 * @returns Number of successfully processed jobs
 */
async function scrapeJobsWithClicks(
  page: Page,
  siteConfig: ReturnType<typeof getSiteConfig>,
  searchUrl: string,
  platformId: string,
): Promise<number> {

  console.log("\n🔄 Starting SPA scraping mode (click-based navigation)");

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
        console.error(
          `      ❌ Error processing job ${jobNumber}:`,
          error instanceof Error ? error.message : String(error),
        );
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
  console.log(`🔧 Scraper method: ${config.scraperMethod}`);

  let processedCount: number;

  try {
    if (config.scraperMethod === "playwright") {
      // Launch Playwright browser
      const context = await launchBrowser("/tmp/scraper-profile", {
        headless: config.isDevelopment ? false : true,
      });

      try {
        const page = await context.newPage();
        await page.goto(searchUrl, { waitUntil: "load", timeout: 30000 });

        // Route by navigation type
        if (navigationType === "click") {
          const siteConfig = getSiteConfig(searchUrl);
          processedCount = await scrapeJobsWithClicks(
            page,
            siteConfig,
            searchUrl,
            platformId,
          );
        } else {
          processedCount = await scrapeJobsWithUrls(page, searchUrl, platformId);
        }
      } finally {
        await context.close(); // Always cleanup
      }
    } else {
      // Default: Browser-Use
      processedCount = await scrapeJobsWithBrowserUse(
        searchUrl,
        navigationType,
        platformId,
      );
    }

    console.log(`\n✅ Successfully processed ${processedCount} job(s)\n`);
  } catch (error) {
    console.error(
      `❌ ${config.scraperMethod} scraping failed:`,
      error instanceof Error ? error.message : String(error),
    );

    if (
      config.scraperMethod === "browser-use" &&
      error instanceof Error &&
      error.message.includes("not found")
    ) {
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
