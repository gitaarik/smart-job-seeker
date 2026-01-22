/**
 * Advanced page utilities for Playwright
 * Only includes features Playwright doesn't handle automatically
 */

import type { Page } from "playwright";

/**
 * Wait for page with scroll detection (for infinite scroll pages)
 * Playwright doesn't handle infinite scroll automatically, so we keep this utility
 */
export async function waitWithScrollDetection(
  page: Page,
  options: {
    maxIterations?: number;
    scrollDelay?: number;
  } = {},
): Promise<void> {
  const maxIterations = options.maxIterations || 3;
  const scrollDelay = options.scrollDelay || 2000;

  for (let i = 0; i < maxIterations; i++) {
    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for new content to load
    await page.waitForTimeout(scrollDelay);

    // Check if we can scroll further
    const canScrollMore = await page.evaluate(() => {
      return window.innerHeight + window.scrollY < document.body.scrollHeight;
    });

    if (!canScrollMore) {
      break;
    }
  }

  // Scroll back to top
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

/**
 * Simple delay helper
 */
export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Result of SPA content wait operation
 */
export interface SpaContentWaitResult {
  /** Whether content has stabilized (no significant growth detected) */
  stabilized: boolean;
  /** Final content length in characters */
  contentLength: number;
  /** Number of poll attempts made */
  pollAttempts: number;
  /** Total content growth detected during polling */
  totalGrowth: number;
}

/**
 * Wait for SPA content to load by detecting content growth
 *
 * Polls the page's text content length to detect if content is still loading.
 * Returns when content stabilizes (no significant growth for consecutive polls)
 * or max attempts reached.
 *
 * @param page - Playwright page instance
 * @param options - Configuration options
 * @returns Result indicating stabilization status and content metrics
 */
export async function waitForSpaContent(
  page: Page,
  options: {
    /** Max number of poll attempts (default: 3) */
    maxAttempts?: number;
    /** Interval between polls in ms (default: 2000) */
    pollInterval?: number;
    /** Min character growth to consider "still loading" (default: 500) */
    minGrowthThreshold?: number;
  } = {},
): Promise<SpaContentWaitResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const pollInterval = options.pollInterval ?? 2000;
  const minGrowthThreshold = options.minGrowthThreshold ?? 500;

  // Get initial content length
  let previousLength = await page.evaluate(
    () => document.body.innerText.length,
  );
  let totalGrowth = 0;
  let consecutiveStablePolls = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await delay(pollInterval);

    const currentLength = await page.evaluate(
      () => document.body.innerText.length,
    );
    const growth = currentLength - previousLength;
    totalGrowth += Math.max(0, growth);

    console.log(
      `      📊 Content poll ${attempt}/${maxAttempts}: ${currentLength.toLocaleString()} chars` +
        (growth > 0 ? ` (+${growth.toLocaleString()})` : "") +
        (growth >= minGrowthThreshold ? " - still loading" : " - stable"),
    );

    if (growth < minGrowthThreshold) {
      consecutiveStablePolls++;
      // Content is stable if no significant growth for 2 consecutive polls
      // or if this is the last attempt
      if (consecutiveStablePolls >= 2 || attempt === maxAttempts) {
        return {
          stabilized: true,
          contentLength: currentLength,
          pollAttempts: attempt,
          totalGrowth,
        };
      }
    } else {
      consecutiveStablePolls = 0;
    }

    previousLength = currentLength;
  }

  // Max attempts reached with content still growing
  const finalLength = await page.evaluate(() => document.body.innerText.length);
  return {
    stabilized: false,
    contentLength: finalLength,
    pollAttempts: maxAttempts,
    totalGrowth,
  };
}
