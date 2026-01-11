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
