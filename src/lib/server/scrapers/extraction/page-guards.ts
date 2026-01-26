/**
 * Page-level guards and checks for SPA scraping
 */

import type { Page } from "playwright";
import { SCRAPER_CONSTANTS } from "../utils";

/**
 * Result of duplicate page detection
 */
export interface DuplicatePageResult {
  isDuplicate: boolean;
  duplicatePercentage: number;
  duplicateCount: number;
  totalJobs: number;
}

/**
 * Detect if current page has duplicate jobs from previous page
 * Used to detect SPA pagination false positives
 *
 * Compares job titles (not clickable IDs) since IDs are regenerated on each page load.
 *
 * @param currentJobTitles Job titles from current page
 * @param previousPageJobTitles Job titles from previous page
 * @returns Whether this appears to be a duplicate page
 */
export function detectDuplicatePage(
  currentJobTitles: string[],
  previousPageJobTitles: string[],
): DuplicatePageResult {
  if (previousPageJobTitles.length === 0 || currentJobTitles.length === 0) {
    return {
      isDuplicate: false,
      duplicatePercentage: 0,
      duplicateCount: 0,
      totalJobs: currentJobTitles.length,
    };
  }

  // Normalize titles for comparison (lowercase, trim)
  const normalizedPrevious = new Set(
    previousPageJobTitles.map((t) => t.toLowerCase().trim()),
  );
  const duplicateCount = currentJobTitles.filter((title) =>
    normalizedPrevious.has(title.toLowerCase().trim())
  ).length;

  const duplicatePercentage = (duplicateCount / currentJobTitles.length) * 100;

  const isDuplicate =
    duplicatePercentage > SCRAPER_CONSTANTS.DUPLICATE_PAGE_THRESHOLD_PERCENT;

  if (isDuplicate) {
    console.log(
      `\n   ⏭️  Stopping: ${
        duplicatePercentage.toFixed(0)
      }% duplicate jobs (${duplicateCount}/${currentJobTitles.length})`,
    );
    console.log(
      "   This page has the same jobs as the previous page (SPA pagination artifact)",
    );
  }

  return {
    isDuplicate,
    duplicatePercentage,
    duplicateCount,
    totalJobs: currentJobTitles.length,
  };
}

/**
 * Result of login page detection
 */
export interface LoginPageResult {
  isLoginPage: boolean;
  hasLoginForm: boolean;
  hasLoginKeywords: boolean;
}

/**
 * Detect if the current page is a login/signup page
 * Should stop scraping if we hit a login wall
 *
 * @param page Playwright page instance
 * @param jobCount Number of jobs found on page (few jobs + login = likely login wall)
 * @returns Whether this appears to be a login page
 */
export async function detectLoginPage(
  page: Page,
  jobCount: number,
): Promise<LoginPageResult> {
  const pageText = (await page.textContent("body")) || "";
  const lowerText = pageText.toLowerCase();

  // Look for login forms, not just text
  const hasLoginForm =
    (await page.locator('form[action*="login"]').count()) > 0 ||
    (await page.locator('input[type="password"]').count()) > 0;

  const hasLoginKeywords = lowerText.includes("sign in to continue") ||
    lowerText.includes("log in to continue") ||
    lowerText.includes("create an account") ||
    (lowerText.includes("email") &&
      lowerText.includes("password") &&
      lowerText.includes("submit"));

  const isLoginPage = (hasLoginForm || hasLoginKeywords) && jobCount < 5;

  if (isLoginPage) {
    console.log("\n   🚫 Login/signup page detected - stopping scrape");
    console.log(
      `   Reason: hasLoginForm=${hasLoginForm}, hasLoginKeywords=${hasLoginKeywords}, jobs=${jobCount}`,
    );
    console.log(
      "   💡 Please log in manually in the browser and run the scraper again",
    );
  }

  return {
    isLoginPage,
    hasLoginForm,
    hasLoginKeywords,
  };
}
