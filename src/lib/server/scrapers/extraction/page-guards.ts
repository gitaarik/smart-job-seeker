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
 * @param currentJobIds Clickable IDs from current page
 * @param previousPageJobIds Clickable IDs from previous page
 * @returns Whether this appears to be a duplicate page
 */
export function detectDuplicatePage(
  currentJobIds: number[],
  previousPageJobIds: number[],
): DuplicatePageResult {
  if (previousPageJobIds.length === 0 || currentJobIds.length === 0) {
    return {
      isDuplicate: false,
      duplicatePercentage: 0,
      duplicateCount: 0,
      totalJobs: currentJobIds.length,
    };
  }

  const duplicateCount =
    currentJobIds.filter((id) => previousPageJobIds.includes(id)).length;

  const duplicatePercentage = (duplicateCount / currentJobIds.length) * 100;

  const isDuplicate =
    duplicatePercentage > SCRAPER_CONSTANTS.DUPLICATE_PAGE_THRESHOLD_PERCENT;

  if (isDuplicate) {
    console.log(
      `\n   ⏭️  Stopping: ${
        duplicatePercentage.toFixed(0)
      }% duplicate jobs (${duplicateCount}/${currentJobIds.length})`,
    );
    console.log(
      "   This page has the same jobs as the previous page (SPA pagination artifact)",
    );
  }

  return {
    isDuplicate,
    duplicatePercentage,
    duplicateCount,
    totalJobs: currentJobIds.length,
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
