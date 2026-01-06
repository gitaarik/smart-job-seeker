/**
 * Interactive scraper utilities
 * Handles user interactions during scraping (login, CAPTCHA)
 */

import type { Page } from "patchright";
import { config } from "./config";
import { detectCaptchaOnPage } from "./cdp-utils";

/**
 * Wait for user to manually solve CAPTCHA
 * @param page Playwright page with CAPTCHA challenge
 * @returns true if solved, false if timeout
 */
export async function waitForCaptchaSolution(page: Page): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("🤖 CAPTCHA Challenge Detected");
  console.log("=".repeat(60));
  console.log("Please solve the CAPTCHA in the browser window.");
  console.log("The script will automatically continue once solved.");
  console.log("=".repeat(60) + "\n");

  const checkInterval = config.scraperCaptchaCheckInterval;

  // Wait indefinitely for CAPTCHA to be solved (check every 3 seconds)
  while (true) {
    console.log("⏱️  Waiting for CAPTCHA solution...");

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
}

/**
 * Wait for user to manually log in
 * @param page Playwright page with login required
 * @returns true if logged in, false if timeout
 */
export async function waitForLoginSolution(page: Page): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 Login Required");
  console.log("=".repeat(60));
  console.log("Please log in to the website in the browser window.");
  console.log(
    "Once you're logged in, press ENTER in this terminal to continue.",
  );
  console.log("=".repeat(60) + "\n");

  // Wait for user to press Enter (no timeout)
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Press ENTER when you've completed the login: ", () => {
      rl.close();
      console.log("✅ Login confirmed! Continuing...\n");
      resolve(true);
    });
  });
}

/**
 * Detect and extract modal content after clicking a job card
 * @returns Object with modalContent (HTML string) and modalSelector (CSS selector used)
 */
export async function detectModalContent(
  page: Page,
): Promise<{ modalContent: string | null; modalSelector: string | null }> {
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
