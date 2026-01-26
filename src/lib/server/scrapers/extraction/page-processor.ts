/**
 * Search page processing: CDP marking, HTML stripping, and LLM extraction
 */

import type { Page } from "playwright";
import { dbDirect } from "$lib/db";
import { config } from "$lib/server/config";
import { stripHtmlForLlm } from "$lib/server/html/strip";
import { markClickableElementsInContainer } from "$lib/server/browser/cdp-utils";
import { getErrorMessage } from "../utils";
import { extractJobsFromSearchPage } from "./llm-extract";
import {
  classifyMarkedClickables,
  stripActionClickables,
  tryContentRetryOnLoad,
} from "./click-helpers";

/**
 * Scroll through the page to reveal lazy-loaded content
 * Many sites (like LinkedIn) only render job cards as they come into view
 * This ensures all content is loaded before extraction
 */
async function scrollToRevealLazyContent(page: Page): Promise<void> {
  const scrollStep = 500; // pixels per scroll
  const scrollDelay = 300; // ms to wait for lazy content to load
  const maxScrolls = 20; // safety limit

  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const getScrollHeight = () => page.evaluate(() => document.body.scrollHeight);

  let currentPosition = 0;
  let scrollCount = 0;
  let previousHeight = await getScrollHeight();

  console.log("      📜 Scrolling to reveal lazy-loaded content...");

  while (scrollCount < maxScrolls) {
    // Scroll down
    currentPosition += scrollStep;
    await page.evaluate((pos) => window.scrollTo(0, pos), currentPosition);
    await page.waitForTimeout(scrollDelay);

    // Check if we've reached the bottom
    const scrollHeight = await getScrollHeight();
    if (currentPosition >= scrollHeight - viewportHeight) {
      // Check if page grew (more content loaded)
      if (scrollHeight > previousHeight) {
        previousHeight = scrollHeight;
        // Continue scrolling if new content appeared
      } else {
        // Reached bottom, no more content loading
        break;
      }
    }

    scrollCount++;
  }

  // Scroll back to top for extraction
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  console.log(`      ✓ Scrolled ${scrollCount} times to load all content`);
}

/**
 * Job data extracted from search page
 */
export interface SearchPageJob {
  clickableId: number;
  title: string | null;
  company?: string | null;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
}

/**
 * Result of processing a search page
 */
export interface PageProcessingResult {
  jobs: SearchPageJob[];
  strippedHtml: string;
  clickableCount: number;
  error?: string;
}

/**
 * Mark clickable elements and classify them using CDP and LLM
 * @returns Cleaned HTML with action clickables stripped, or null if no clickables found
 */
async function markAndClassifyClickables(
  jobSearchId: number,
  page: Page,
): Promise<{ cleanedHtml: string; clickableCount: number } | null> {
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
    return null;
  }

  // Classify clickables with LLM to filter out action buttons (Apply, Share, etc.)
  let clickableClassifications: Map<number, "view-details" | "action"> | null =
    null;
  if (clickableCount > 1) {
    console.log("   🏷️  Step 1.5/3: Classifying clickables with LLM...");
    const startClassify = Date.now();
    clickableClassifications = await classifyMarkedClickables(
      jobSearchId,
      page,
    );
    const actionCount = [...clickableClassifications.values()].filter(
      (v) => v === "action",
    ).length;
    const classifyDuration = ((Date.now() - startClassify) / 1000).toFixed(2);
    console.log(
      `      ✓ ${
        clickableCount - actionCount
      } view-details, ${actionCount} action (${classifyDuration}s)`,
    );
  }

  // Get marked HTML and strip action clickables
  const markedHtml = await page.content();
  const cleanedHtml = clickableClassifications
    ? stripActionClickables(markedHtml, clickableClassifications)
    : markedHtml;

  return { cleanedHtml, clickableCount };
}

/**
 * Process HTML: strip for LLM, add debug header, save to database
 */
function processHtmlForExtraction(
  cleanedHtml: string,
  clickableCount: number,
  captureUrl: string,
  captureTitle: string,
): { strippedHtml: string; debugHeader: string } {
  const htmlSize = (cleanedHtml.length / 1024).toFixed(1);
  console.log(`      HTML size (raw): ${htmlSize} KB`);

  // Strip HTML for LLM processing (data-xxx attributes survive)
  const strippedHtml = stripHtmlForLlm(cleanedHtml);

  // Count clickable IDs that survived stripping
  const clickableIdMatches = strippedHtml.match(/data-xxx/g);
  const survivingClickables = clickableIdMatches
    ? clickableIdMatches.length
    : 0;
  const strippedSize = (strippedHtml.length / 1024).toFixed(1);
  console.log(
    `      HTML size (stripped): ${strippedSize} KB, clickables preserved: ${survivingClickables}/${clickableCount}`,
  );

  // Build debug header
  const debugHeader = [
    `<!-- DEBUG INFO`,
    `URL: ${captureUrl}`,
    `Title: ${captureTitle}`,
    `Raw HTML: ${htmlSize} KB`,
    `Stripped HTML: ${strippedSize} KB`,
    `CDP clickables found: ${clickableCount}`,
    `Clickables after strip: ${survivingClickables}`,
    `Timestamp: ${new Date().toISOString()}`,
    `-->`,
  ].join("\n");

  return { strippedHtml, debugHeader };
}

/**
 * Extract jobs from search page using LLM with retry logic for slow-loading SPAs
 */
async function extractJobsWithRetry(
  jobSearchId: number,
  page: Page,
  strippedHtml: string,
  pageNumber: number,
  savedStrippedHtml: string,
): Promise<{
  jobs: SearchPageJob[];
  savedHtml: string;
  error?: string;
}> {
  let jobs: SearchPageJob[] = [];
  let currentStrippedHtml = strippedHtml;
  let currentSavedHtml = savedStrippedHtml;
  let extractionAttempt = 0;
  const maxLlmRetries = config.scraperSpaLlmRetryAttempts;

  // Extraction loop with SPA content loading detection
  while (extractionAttempt <= maxLlmRetries) {
    extractionAttempt++;
    const startLlm = Date.now();

    try {
      const result = await extractJobsFromSearchPage(
        jobSearchId,
        currentStrippedHtml,
      );
      jobs = result.jobs;

      const llmDuration = ((Date.now() - startLlm) / 1000).toFixed(2);
      console.log(`      ✓ LLM analysis complete (${llmDuration}s)`);
      console.log(`      Job cards found: ${jobs.length}`);

      // If jobs found, we're done
      if (jobs.length > 0) {
        if (extractionAttempt > 1) {
          console.log(
            `      ℹ️  Required ${extractionAttempt} extraction attempts`,
          );
        }
        break;
      }

      // No jobs found - check if page is still loading (only if we have retries left)
      if (extractionAttempt <= maxLlmRetries) {
        console.log(
          "      ⚠️  No jobs found, checking if page is still loading...",
        );

        const retry = await tryContentRetryOnLoad(
          page,
          pageNumber,
          extractionAttempt,
          maxLlmRetries,
          jobSearchId,
          currentSavedHtml,
        );

        if (retry.shouldRetry) {
          currentStrippedHtml = retry.newStrippedHtml;
          currentSavedHtml = retry.savedHtml;
          continue;
        } else {
          console.log("      📊 Content stabilized but no job cards found");
          break;
        }
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);

      // Check if this is an "all jobs invalid" error - treat like 0 jobs found
      const isAllInvalidError = errorMsg.includes("had no title");

      if (isAllInvalidError && extractionAttempt <= maxLlmRetries) {
        console.log(
          "      ⚠️  All extracted jobs were invalid, checking if page is still loading...",
        );

        const retry = await tryContentRetryOnLoad(
          page,
          pageNumber,
          extractionAttempt,
          maxLlmRetries,
          jobSearchId,
          currentSavedHtml,
        );

        if (retry.shouldRetry) {
          currentStrippedHtml = retry.newStrippedHtml;
          currentSavedHtml = retry.savedHtml;
          continue;
        } else {
          console.log(
            "      📊 Content stabilized but no valid job cards found",
          );
        }
      }

      console.error(`      ❌ LLM extraction failed: ${errorMsg}`);
      return {
        jobs: [],
        savedHtml: currentSavedHtml,
        error: errorMsg,
      };
    }
  }

  return { jobs, savedHtml: currentSavedHtml };
}

/**
 * Process a search page to extract job cards
 * Handles CDP marking, clickable classification, HTML processing, and LLM extraction
 *
 * @param jobSearchId Job search ID (required for profile lookup and debug HTML)
 * @param page Playwright page instance
 * @param pageNumber Current page number (1-indexed)
 * @param existingSavedHtml Previous saved HTML (for subsequent pages)
 * @returns Extracted jobs, stripped HTML for debugging, and clickable count
 */
export async function processSearchPage(
  jobSearchId: number,
  page: Page,
  pageNumber: number,
  existingSavedHtml?: string,
): Promise<PageProcessingResult> {
  console.log(`\n📄 Page ${pageNumber}...`);

  // Step 0: Scroll through page to reveal lazy-loaded content
  await scrollToRevealLazyContent(page);

  // Step 1: Mark and classify clickables
  const markResult = await markAndClassifyClickables(jobSearchId, page);
  if (!markResult) {
    return {
      jobs: [],
      strippedHtml: existingSavedHtml || "",
      clickableCount: 0,
    };
  }

  const { cleanedHtml, clickableCount } = markResult;

  // Capture page info for debugging
  const captureUrl = page.url();
  const captureTitle = await page.title();
  console.log(`      📍 Capturing HTML from: ${captureUrl}`);
  console.log(`      📄 Page title: "${captureTitle}"`);

  // Step 2: Process HTML for LLM extraction
  const { strippedHtml, debugHeader } = processHtmlForExtraction(
    cleanedHtml,
    clickableCount,
    captureUrl,
    captureTitle,
  );

  // Build saved HTML with debug header (only for first page or if no existing)
  let savedStrippedHtml = existingSavedHtml || "";
  if (pageNumber === 1 || !savedStrippedHtml) {
    savedStrippedHtml = debugHeader + "\n" + strippedHtml;

    // Log Directus admin URL for debugging stripped HTML
    console.log(
      `      📋 Debug stripped HTML: ${config.adminPublicUrl}/admin/content/job_searches/${jobSearchId}`,
    );

    // Save stripped HTML immediately for debugging (before LLM extraction)
    await dbDirect.job_searches.update({
      where: { id: jobSearchId },
      data: { stripped_html: savedStrippedHtml },
    });
  }

  // Step 3: Extract jobs using LLM with retry logic
  console.log(
    "\n   🤖 Step 2/3: Asking LLM to extract job cards with titles...",
  );

  const extractResult = await extractJobsWithRetry(
    jobSearchId,
    page,
    strippedHtml,
    pageNumber,
    savedStrippedHtml,
  );

  if (extractResult.error) {
    return {
      jobs: [],
      strippedHtml: extractResult.savedHtml,
      clickableCount,
      error: extractResult.error,
    };
  }

  // Log job cards found
  console.log(
    `      Jobs: [${
      extractResult.jobs.map((j) => `${j.clickableId}:${j.title || "?"}`).join(
        ", ",
      )
    }]`,
  );

  return {
    jobs: extractResult.jobs,
    strippedHtml: extractResult.savedHtml,
    clickableCount,
  };
}
