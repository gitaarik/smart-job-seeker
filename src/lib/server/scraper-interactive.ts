/**
 * Interactive scraper utilities
 * Handles user interactions during scraping (login, CAPTCHA, modal detection)
 */

import type { Page } from "playwright";
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
 * First tries DOM-based detection (faster, more reliable), then falls back to LLM
 * @param page Playwright page after clicking a job card
 * @returns Object with modalContent (HTML string) and modalSelector
 */
export async function detectModalContent(
  page: Page,
): Promise<{ modalContent: string | null; modalSelector: string | null }> {
  // 1. First try DOM-based detection (faster and more reliable)
  // Common modal/dialog patterns
  const modalSelectors = [
    // ARIA patterns
    '[role="dialog"]',
    '[aria-modal="true"]',
    // Common class patterns (job sites often use these)
    '[class*="modal"]:not([class*="modal-backdrop"])',
    '[class*="Modal"]:not([class*="Backdrop"])',
    '[class*="dialog"]',
    '[class*="Dialog"]',
    '[class*="drawer"]',
    '[class*="Drawer"]',
    '[class*="slide-panel"]',
    '[class*="SlidePanel"]',
    '[class*="job-detail"]',
    '[class*="JobDetail"]',
    '[class*="job-description"]',
    '[class*="JobDescription"]',
    // Turing-specific patterns
    '[class*="sidebar"]',
    '[class*="Sidebar"]',
  ];

  for (const selector of modalSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const isVisible = await element.isVisible({ timeout: 500 }).catch(
          () => false,
        );

        if (isVisible) {
          const content = await element.innerHTML({ timeout: 2000 }).catch(
            () => null,
          );
          // Modal content should be substantial (> 500 chars) to be a job detail
          if (content && content.length > 500) {
            console.log(
              `      ✓ Detected modal content via DOM (${selector}, ${content.length} chars)`,
            );
            return { modalContent: content, modalSelector: selector };
          }
        }
      }
    } catch {
      // Selector didn't match, continue
    }
  }

  // 2. DOM detection failed, try LLM-based detection
  console.log(`      ℹ️  DOM modal detection found nothing, trying LLM...`);

  const html = await page.content();
  const strippedHtml = stripHtmlForLlm(html);

  const result = await createJobScrapingAiChat<{
    selector: string | null;
    confidence: number;
    contentType: string;
  }>("detect_job_detail_content", { html: strippedHtml });

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
          `      ✓ Detected ${result.response.contentType} content via LLM (${result.response.confidence}% confidence)`,
        );
        return {
          modalContent: content,
          modalSelector: result.response.selector,
        };
      }
    } catch {
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
