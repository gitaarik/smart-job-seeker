/**
 * Pagination utilities using data-xxx markers
 * Uses LLM to identify pagination elements from marked HTML
 */

import type { Page } from "playwright";
import { stripHtmlForLlm } from "../html/strip";
import { waitForSpaContent } from "./page-wait";
import { createJobScrapingAiChat } from "../ai-chat/job-utils";
import { markClickableElementsInContainer } from "../browser/cdp-utils";
import { config } from "../config";

/**
 * Result of finding the next page button
 */
export interface NextPageResult {
  found: boolean;
  dataXxxId: number | null;
  paginationType: "next_prev" | "load_more" | "none";
}

/**
 * Find the next page button using CDP marking + LLM
 * Marks all clickables, sends to LLM, returns the data-xxx ID of next button
 */
export async function findNextPageButton(
  jobSearchId: number,
  page: Page,
): Promise<NextPageResult> {
  console.log("   🔍 Looking for pagination...");

  // Mark all clickable elements
  const clickableCount = await markClickableElementsInContainer(page, "body");
  if (clickableCount === 0) {
    console.log("      No clickable elements found");
    return { found: false, dataXxxId: null, paginationType: "none" };
  }

  console.log(`      Marked ${clickableCount} clickable elements`);

  // Get marked HTML and strip for LLM
  const markedHtml = await page.content();
  const strippedHtml = stripHtmlForLlm(markedHtml);

  // Ask LLM to identify the next page button
  const htmlSizeKb = (strippedHtml.length / 1024).toFixed(1);
  console.log(
    `      Asking LLM to identify next page button (${htmlSizeKb} KB)...`,
  );

  const result = await createJobScrapingAiChat<{
    found: boolean;
    dataXxxId: number | null;
    paginationType: "next_prev" | "load_more" | "none";
  }>(jobSearchId, "find_next_page_button", { html: strippedHtml });

  if (!result.success || !result.response) {
    console.log("      LLM returned no result");
    if (result.message) {
      console.log("      Message:", result.message);
    }
    return { found: false, dataXxxId: null, paginationType: "none" };
  }

  const parsed = result.response;

  if (!parsed.found || parsed.dataXxxId === null) {
    console.log("      No pagination button found by LLM");
    return { found: false, dataXxxId: null, paginationType: "none" };
  }

  console.log(
    `      ✓ Found ${parsed.paginationType} button: data-xxx="${parsed.dataXxxId}"`,
  );
  return {
    found: true,
    dataXxxId: parsed.dataXxxId,
    paginationType: parsed.paginationType || "next_prev",
  };
}

/**
 * Navigate to the next page by clicking the element with given data-xxx ID
 */
export async function navigateToNextPage(
  page: Page,
  dataXxxId: number,
): Promise<boolean> {
  const selector = `[data-xxx="${dataXxxId}"]`;
  console.log(`      → Clicking pagination button: ${selector}`);

  try {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible({ timeout: 2000 }).catch(
      () => false,
    );

    if (!isVisible) {
      console.log(`      ✗ Pagination button not visible`);
      return false;
    }

    // Scroll element into view first
    await button.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    // Click the button
    await button.click();

    // Wait for content to stabilize after click
    const stabilize = await waitForSpaContent(page, {
      maxAttempts: config.scraperSpaContentPollAttempts,
      pollInterval: config.scraperSpaContentPollInterval,
      minGrowthThreshold: config.scraperSpaMinContentGrowth,
    });

    console.log(
      `      ✓ Navigation complete (${stabilize.contentLength.toLocaleString()} chars)`,
    );
    return true;
  } catch (error) {
    console.warn(`      ✗ Failed to click pagination button:`, error);
    return false;
  }
}
