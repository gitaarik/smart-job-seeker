/**
 * Interactive scraper utilities
 * Handles user interactions during scraping (login, CAPTCHA, modal detection)
 */

import type { Page } from "patchright";
import { config } from "./config";
import { detectCaptchaOnPage } from "./cdp-utils";
import { stripHtmlForLlm } from "./html-strip";
import { createJobScrapingAiChat } from "./ai-chat-job-utils";

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
 * Detect job detail content after clicking a job card
 * Uses LLM to identify where job details appeared (modal, side panel, inline expansion)
 * @param page Playwright page after clicking a job card
 * @returns Object with modalContent (HTML string) and modalSelector
 */
export async function detectModalContent(
  page: Page,
): Promise<{ modalContent: string | null; modalSelector: string | null }> {
  // 1. Get full page HTML
  const html = await page.content();

  // 2. Strip HTML for LLM processing
  const strippedHtml = stripHtmlForLlm(html);

  // 3. Ask LLM to identify job detail section
  const result = await createJobScrapingAiChat<{
    selector: string | null;
    confidence: number;
    contentType: string;
  }>("detect_job_detail_content", { html: strippedHtml });

  // 4. If LLM found a selector with good confidence, extract that content
  if (
    result.success &&
    result.response?.selector &&
    result.response.confidence > 60
  ) {
    try {
      const element = page.locator(result.response.selector).first();
      const isVisible = await element.isVisible({ timeout: 2000 });

      if (isVisible) {
        const content = await element.innerHTML({ timeout: 5000 });
        console.log(
          `      ✓ Detected ${result.response.contentType} content (${result.response.confidence}% confidence)`,
        );
        return { modalContent: content, modalSelector: result.response.selector };
      }
    } catch (e) {
      console.log(
        `      ⚠️  LLM suggested selector "${result.response.selector}" but it didn't match`,
      );
    }
  }

  // Log why we're returning null
  if (!result.success) {
    console.log(`      ⚠️  LLM detection failed: ${result.message}`);
  } else if (!result.response?.selector) {
    console.log(`      ⚠️  LLM couldn't identify job detail container`);
  } else if (result.response.confidence <= 60) {
    console.log(
      `      ⚠️  LLM confidence too low (${result.response.confidence}%), skipping selector`,
    );
  }

  return { modalContent: null, modalSelector: null };
}
