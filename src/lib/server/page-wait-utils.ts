/**
 * Advanced page utilities for Playwright
 * Only includes features Playwright doesn't handle automatically
 */

import type { Page } from "patchright";

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
