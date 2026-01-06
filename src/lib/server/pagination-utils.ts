/**
 * Pagination and Infinite Scroll Detection & Navigation
 * Utilities for detecting and navigating through paginated job listings
 */

import type { Page } from "patchright";
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
 * @param page Playwright page instance
 * @param html Optional HTML content (uses page.content() if not provided)
 * @param platformPaginationType Optional pagination type from platform config (overrides auto-detection)
 */
export async function detectPaginationStrategy(
  page: Page,
  html?: string,
  platformPaginationType?: string | null,
): Promise<PaginationInfo> {
  // Platform configuration takes highest priority
  if (platformPaginationType) {
    console.log(
      `   ✓ Using platform pagination config: ${platformPaginationType}`,
    );

    // Map the platform config to PaginationInfo
    switch (platformPaginationType) {
      case "infinite_scroll":
        return {
          hasPagination: false,
          hasInfiniteScroll: true,
          paginationType: "infinite_scroll",
        };
      case "next_prev":
        return {
          hasPagination: true,
          hasInfiniteScroll: false,
          paginationType: "next_prev",
        };
      case "numbered":
        return {
          hasPagination: true,
          hasInfiniteScroll: false,
          paginationType: "numbered",
        };
      case "load_more":
        return {
          hasPagination: false,
          hasInfiniteScroll: true,
          paginationType: "load_more",
        };
      case "none":
        return {
          hasPagination: false,
          hasInfiniteScroll: false,
          paginationType: "none",
        };
    }
  }

  // Heuristic check first (fast) - common pagination patterns
  // Check for "Next" buttons with various patterns
  const nextSelectors = [
    'a:has-text("Next"), button:has-text("Next")', // Text-based
    '[aria-label*="Next" i]', // ARIA labels (case-insensitive)
    'a:has-text("›"), button:has-text("›")', // Single arrow
    'a:has-text("→"), button:has-text("→")', // Arrow symbol
    'a:has-text("»"), button:has-text("»")', // Double arrow
    '[class*="next" i]:is(a, button)', // Class names containing "next"
    '[class*="pagination" i] a:last-child, [class*="pagination" i] button:last-child', // Last item in pagination
  ];

  let nextButtonSelector: string | null = null;
  for (const selector of nextSelectors) {
    const isVisible = await page.locator(selector).first().isVisible({
      timeout: 500,
    }).catch(() => false);
    if (isVisible) {
      nextButtonSelector = selector;
      break;
    }
  }

  const hasLoadMore = await page
    .locator('button:has-text("Load More"), button:has-text("Show More")')
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  // If obvious pagination found, return immediately
  if (nextButtonSelector) {
    console.log(`   ✓ Heuristic detected next button: ${nextButtonSelector}`);
    return {
      hasPagination: true,
      hasInfiniteScroll: false,
      nextButtonSelector,
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
  console.log("   → Falling back to LLM for pagination detection...");
  try {
    const strippedHtml = html || stripHtmlForLlm(await page.content());
    const llmResult = await detectPaginationWithLLM(strippedHtml);
    console.log(`   ✓ LLM detected: ${llmResult.paginationType}`);
    return llmResult;
  } catch (error) {
    console.warn("   ✗ LLM pagination detection failed:", error);
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
      console.log(`      → Navigating to URL: ${info.nextPageUrl}`);
      await page.goto(info.nextPageUrl, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(2000); // Rate limiting
      console.log(`      ✓ URL navigation complete`);
      return true;
    }

    if (info.nextButtonSelector) {
      // Click-based pagination
      console.log(`      → Looking for button: ${info.nextButtonSelector}`);
      const nextButton = page.locator(info.nextButtonSelector).first();
      const isVisible = await nextButton.isVisible({ timeout: 2000 }).catch(
        () => false,
      );

      if (isVisible) {
        console.log(`      → Clicking next button...`);
        await nextButton.click();
        await page.waitForTimeout(2000); // Wait for content
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(
          () => {},
        );
        console.log(`      ✓ Button click complete`);
        return true;
      } else {
        console.log(`      ✗ Next button not visible`);
      }
    }

    if (info.loadMoreSelector) {
      // "Load More" button
      console.log(`      → Looking for load more: ${info.loadMoreSelector}`);
      const loadButton = page.locator(info.loadMoreSelector).first();
      const isVisible = await loadButton.isVisible({ timeout: 2000 }).catch(
        () => false,
      );

      if (isVisible) {
        console.log(`      → Clicking load more...`);
        await loadButton.click();
        await page.waitForTimeout(2000);
        console.log(`      ✓ Load more click complete`);
        return true;
      } else {
        console.log(`      ✗ Load more button not visible`);
      }
    }

    console.log(`      ✗ No navigation method available`);
    return false; // No navigation possible
  } catch (error) {
    console.warn(`      ✗ Failed to navigate to next page:`, error);
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
  // Get initial content to detect changes (more reliable than scroll height for SPAs)
  const initialContent = await page.content();
  const initialLength = initialContent.length;

  console.log(`      Initial content: ${(initialLength / 1024).toFixed(1)} KB`);

  // Scroll multiple times to trigger lazy loading
  const maxIterations = options.maxScrolls;
  const scrollDelay = 2000;

  for (let i = 0; i < maxIterations; i++) {
    console.log(`      Scroll iteration ${i + 1}/${maxIterations}...`);

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for new content to load
    await page.waitForTimeout(scrollDelay);

    // Check if content changed (new jobs loaded)
    const currentContent = await page.content();
    const currentLength = currentContent.length;

    if (currentLength > initialLength) {
      console.log(
        `      ✓ New content detected: ${
          ((currentLength - initialLength) / 1024).toFixed(1)
        } KB added`,
      );
      // Return immediately when new content is found
      return 1;
    }

    console.log(
      `      No new content yet (${(currentLength / 1024).toFixed(1)} KB)`,
    );
  }

  console.log(`      ✗ No new content after ${maxIterations} scroll(s)`);

  // Scroll back to top for next extraction
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  return 0; // No new content loaded
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

  // Handle invalid LLM responses
  if (!result.content || result.content === "undefined") {
    return {
      hasPagination: false,
      hasInfiniteScroll: false,
      paginationType: "none",
    };
  }

  try {
    return JSON.parse(result.content);
  } catch (error) {
    console.warn(
      "Failed to parse LLM pagination response:",
      result.content,
    );
    return {
      hasPagination: false,
      hasInfiniteScroll: false,
      paginationType: "none",
    };
  }
}
