/**
 * Pagination and Infinite Scroll Detection & Navigation
 * Utilities for detecting and navigating through paginated job listings
 */

import type { Page } from "playwright";
import { stripHtmlForLlm } from "./html-strip";
import { waitWithScrollDetection } from "./page-wait-utils";
import { generateAiChatResponse } from "./ai-chat-response-generate";

export interface PaginationInfo {
  hasPagination: boolean;
  hasInfiniteScroll: boolean;
  nextButtonSelector?: string | null;
  nextPageUrl?: string | null;
  loadMoreSelector?: string | null;
  paginationType:
    | "numbered"
    | "next_prev"
    | "load_more"
    | "infinite_scroll"
    | "none";
}

/**
 * Detect pagination strategy using heuristics + LLM fallback
 * Fast heuristic checks first, then LLM for complex cases
 */
export async function detectPaginationStrategy(
  page: Page,
  html?: string,
): Promise<PaginationInfo> {
  // Heuristic check first (fast) - common pagination patterns
  const hasNextButton = await page
    .locator(
      'a:has-text("Next"), button:has-text("Next"), [aria-label*="Next"]',
    )
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  const hasLoadMore = await page
    .locator('button:has-text("Load More"), button:has-text("Show More")')
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  // If obvious pagination found, return immediately
  if (hasNextButton) {
    return {
      hasPagination: true,
      hasInfiniteScroll: false,
      nextButtonSelector: 'a:has-text("Next"), button:has-text("Next")',
      paginationType: "next_prev",
    };
  }

  if (hasLoadMore) {
    return {
      hasPagination: false,
      hasInfiniteScroll: true,
      loadMoreSelector:
        'button:has-text("Load More"), button:has-text("Show More")',
      paginationType: "load_more",
    };
  }

  // Fallback: Use LLM for complex cases
  try {
    const strippedHtml = html || stripHtmlForLlm(await page.content());
    const llmResult = await detectPaginationWithLLM(strippedHtml);
    return llmResult;
  } catch (error) {
    console.warn("LLM pagination detection failed:", error);
    // Return safe default if LLM fails
    return {
      hasPagination: false,
      hasInfiniteScroll: false,
      paginationType: "none",
    };
  }
}

/**
 * Navigate to the next page
 * Handles URL-based, click-based, and "Load More" button pagination
 */
export async function navigateToNextPage(
  page: Page,
  info: PaginationInfo,
): Promise<boolean> {
  try {
    if (info.nextPageUrl) {
      // URL-based pagination
      await page.goto(info.nextPageUrl, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(2000); // Rate limiting
      return true;
    }

    if (info.nextButtonSelector) {
      // Click-based pagination
      const nextButton = page.locator(info.nextButtonSelector).first();
      const isVisible = await nextButton.isVisible({ timeout: 2000 }).catch(
        () => false,
      );

      if (isVisible) {
        await nextButton.click();
        await page.waitForTimeout(2000); // Wait for content
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(
          () => {},
        );
        return true;
      }
    }

    if (info.loadMoreSelector) {
      // "Load More" button
      const loadButton = page.locator(info.loadMoreSelector).first();
      const isVisible = await loadButton.isVisible({ timeout: 2000 }).catch(
        () => false,
      );

      if (isVisible) {
        await loadButton.click();
        await page.waitForTimeout(2000);
        return true;
      }
    }

    return false; // No navigation possible
  } catch (error) {
    console.warn(`Failed to navigate to next page:`, error);
    return false;
  }
}

/**
 * Perform infinite scroll to load more content
 * Returns 1 if new content loaded, 0 if not
 */
export async function performInfiniteScroll(
  page: Page,
  options: { maxScrolls: number },
): Promise<number> {
  const initialHeight = await page.evaluate(() => document.body.scrollHeight);

  // Use existing scroll utility
  await waitWithScrollDetection(page, {
    maxIterations: options.maxScrolls,
    scrollDelay: 2000,
  });

  const finalHeight = await page.evaluate(() => document.body.scrollHeight);

  // Return 1 if new content loaded, 0 if not
  return finalHeight > initialHeight ? 1 : 0;
}

/**
 * LLM-based pagination detection for complex cases
 * Uses the detect_pagination AI prompt
 */
async function detectPaginationWithLLM(html: string): Promise<PaginationInfo> {
  const result = await generateAiChatResponse({
    request: "detect_pagination",
    variables: { html },
  });

  return JSON.parse(result.content);
}
