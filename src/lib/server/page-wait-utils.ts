/**
 * Smart page waiting utilities for dynamic content loading
 * Handles SPA async content with selector-based validation
 */

import type { Page } from "puppeteer";

export interface WaitStrategy {
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  selector?: string; // Single selector to wait for
  selectors?: string[]; // Multiple selectors (any one matches)
  timeout?: number;
  additionalDelay?: number; // Final delay after all waits
  validator?: (page: Page) => Promise<boolean>; // Custom validation
  retryOptions?: { maxAttempts?: number; initialDelay?: number };
}

export interface WaitResult {
  success: boolean;
  duration: number;
  steps: {
    selector?: { success: boolean; duration: number; selector?: string };
    validation?: { success: boolean; duration: number };
  };
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  allFound: boolean;
  found: string[];
  missing: string[];
  totalChecked: number;
}

/**
 * Smart wait for page content with multiple validation layers
 */
export async function smartWait(
  page: Page,
  strategy: WaitStrategy,
): Promise<WaitResult> {
  const startTime = Date.now();
  const result: WaitResult = {
    success: true,
    duration: 0,
    steps: {},
    errors: [],
    warnings: [],
  };

  try {
    // Step 1: Wait for selector(s) if specified
    if (strategy.selector || strategy.selectors) {
      const selectorStartTime = Date.now();
      const selectorsToTry = strategy.selectors ||
        (strategy.selector ? [strategy.selector] : []);

      let selectorFound = false;
      let matchedSelector: string | undefined;

      for (const selector of selectorsToTry) {
        try {
          await page.waitForSelector(selector, {
            timeout: strategy.timeout || 30000,
            visible: true,
          });
          selectorFound = true;
          matchedSelector = selector;
          break;
        } catch (error) {
          // Try next selector
          continue;
        }
      }

      const selectorDuration = Date.now() - selectorStartTime;
      result.steps.selector = {
        success: selectorFound,
        duration: selectorDuration,
        selector: matchedSelector,
      };

      if (!selectorFound) {
        result.success = false;
        result.errors.push(
          `None of the expected selectors found: ${selectorsToTry.join(", ")}`,
        );
      }
    }

    // Step 2: Run custom validator if provided
    if (strategy.validator) {
      const validationStartTime = Date.now();

      try {
        const validationPassed = await strategy.validator(page);
        const validationDuration = Date.now() - validationStartTime;

        result.steps.validation = {
          success: validationPassed,
          duration: validationDuration,
        };

        if (!validationPassed) {
          result.success = false;
          result.errors.push("Custom validation failed");
        }
      } catch (error) {
        const validationDuration = Date.now() - validationStartTime;
        result.steps.validation = {
          success: false,
          duration: validationDuration,
        };
        result.success = false;
        result.errors.push(
          `Validation error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Step 3: Additional delay for final JS execution
    if (strategy.additionalDelay && strategy.additionalDelay > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, strategy.additionalDelay)
      );
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      `Smart wait failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Validate that expected content selectors exist on the page
 */
export async function validateContentLoaded(
  page: Page,
  selectors: string[],
): Promise<ValidationResult> {
  const found: string[] = [];
  const missing: string[] = [];

  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        found.push(selector);
      } else {
        missing.push(selector);
      }
    } catch {
      missing.push(selector);
    }
  }

  return {
    allFound: missing.length === 0,
    found,
    missing,
    totalChecked: selectors.length,
  };
}

/**
 * Wait for page with scroll detection (for infinite scroll pages)
 * Basic implementation - can be enhanced later
 */
export async function waitWithScrollDetection(
  page: Page,
  options: {
    maxIterations?: number;
    scrollDelay?: number;
    contentSelector?: string;
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
    await new Promise((resolve) => setTimeout(resolve, scrollDelay));

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
