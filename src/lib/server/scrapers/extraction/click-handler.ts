/**
 * Click handling and navigation for job card processing
 */

import type { Page } from "playwright";
import { config } from "$lib/server/config";
import {
  humanClick,
  humanScrollWheel,
  humanWait,
} from "$lib/server/browser/stealth-utils";
import { markClickableElementsInContainer } from "$lib/server/browser/cdp-utils";
import {
  waitForContentChange,
  waitForSpaContent,
} from "$lib/server/utils/page-wait";
import type { ElementInfo } from "../types";

/**
 * Result of clicking a job card, including navigation state
 */
export interface ClickResult {
  contentChanged: boolean;
  /** The page to extract job details from (may be a new tab) */
  extractionPage: Page;
  /** If a new tab was opened, reference to close it later */
  newTab: Page | null;
  /** Whether navigation occurred (URL changed in same tab) */
  navigatedAway: boolean;
  /** Original URL to return to */
  originalUrl: string;
}

/**
 * Check if href is a valid navigable URL (not empty, not # fragment, not javascript:)
 */
export function isNavigableHref(href: string): boolean {
  if (!href || href === "#" || href.startsWith("javascript:")) {
    return false;
  }
  return true;
}

/**
 * Get element info before clicking for debugging
 */
export async function getElementInfo(
  page: Page,
  clickableId: number,
): Promise<ElementInfo> {
  return await page
    .locator(`[data-xxx="${clickableId}"]`)
    .evaluate((el) => {
      const tag = el.tagName.toLowerCase();
      // Normalize whitespace (collapse newlines/spaces) then trim
      const text =
        el.textContent?.replace(/\s+/g, " ").trim().substring(0, 50) || "";
      // Don't truncate href - we need the full URL for navigation
      const href = el.getAttribute("href") || "";
      const ariaLabel = el.getAttribute("aria-label")?.substring(0, 50) || "";
      const className = el.className?.toString().substring(0, 50) || "";
      return { tag, text, href, ariaLabel, className };
    })
    .catch(() => ({
      tag: "?",
      text: "",
      href: "",
      ariaLabel: "",
      className: "",
    }));
}

/**
 * Scroll through job description content to reveal lazy-loaded content
 * Uses human-like mouse wheel scrolling
 */
async function scrollJobDescription(page: Page): Promise<void> {
  // Get viewport center for mouse positioning
  const viewport = page.viewportSize();
  const mouseX = (viewport?.width ?? 1200) / 2;
  const mouseY = (viewport?.height ?? 800) / 2;

  // Scroll down through the content, then back to top
  await humanScrollWheel(page, mouseX, mouseY, {
    scrollSteps: 6,
    baseScrollAmount: 350,
    scrollVariation: 150,
    baseScrollDelay: 250,
    delayVariation: 150,
    scrollBackToTop: true,
  });
}

/**
 * Open a job in a new tab or click to view details
 *
 * For anchor elements with href: opens in new tab to preserve search page
 * For JS click handlers: clicks normally (SPA behavior)
 */
export async function clickJobCard(
  page: Page,
  clickableId: number,
  href: string,
): Promise<ClickResult> {
  // Press Escape to clear any stray modals
  await page.keyboard.press("Escape").catch(() => {});

  const originalUrl = page.url();
  const context = page.context();
  let extractionPage: Page = page;
  let newTab: Page | null = null;
  let navigatedAway = false;

  // If element has a valid href, open in new tab to preserve search page
  if (isNavigableHref(href)) {
    // Resolve relative URLs
    const fullUrl = new URL(href, originalUrl).href;
    console.log(`      📑 Opening in new tab: ${fullUrl}`);

    // Open new tab and navigate
    newTab = await context.newPage();
    await newTab.goto(fullUrl, { waitUntil: "domcontentloaded" });
    await humanWait(newTab, 1000);
    extractionPage = newTab;
  } else {
    // No href - this is a JS click handler (SPA behavior)
    const beforeClick = await page.evaluate(
      () => document.body.innerText.length,
    );

    // Use human-like click
    const selector = `[data-xxx="${clickableId}"]`;
    await humanClick(page, selector);

    // Brief initial wait for click handler to fire
    await humanWait(page, 500);

    // Check if a new tab was opened by the click
    const currentPages = context.pages();
    if (currentPages.length > 1) {
      // Find the new tab (not the original page)
      const possibleNewTab = currentPages.find((p) => p !== page);
      if (possibleNewTab) {
        newTab = possibleNewTab;
        extractionPage = newTab;
        console.log(`      📑 Click opened new tab`);
        await newTab.waitForLoadState("domcontentloaded");
        await humanWait(newTab, 1000);
      }
    }

    // Check if URL changed (navigation in same tab)
    if (!newTab && page.url() !== originalUrl) {
      navigatedAway = true;
      console.log(`      🔀 Navigated to: ${page.url()}`);
      await scrollJobDescription(page);
    }

    // Wait for SPA content to change and stabilize
    if (!newTab && !navigatedAway) {
      const changeResult = await waitForContentChange(page, beforeClick, {
        timeout: config.scraperClickWaitTimeout,
        changeThreshold: 100,
        stabilizeAfter: true,
      });

      if (!changeResult.changed) {
        // Highlight the element with red border for visual debugging
        const selector = `[data-xxx="${clickableId}"]`;
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            (el as HTMLElement).style.border = "3px solid red";
            (el as HTMLElement).style.backgroundColor = "rgba(255,0,0,0.1)";
          }
        }, selector);

        // Log the element's HTML for debugging
        const elementHtml = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el?.outerHTML?.substring(0, 500) || "(element not found)";
        }, selector);

        console.warn(`      ⚠️  Page content didn't change after click`);
        console.warn(`      🔴 Element marked with red border on page`);
        console.warn(`      🔍 Clicked element HTML:\n${elementHtml}`);

        return {
          contentChanged: false,
          extractionPage,
          newTab,
          navigatedAway,
          originalUrl,
        };
      }

      // Content changed - scroll through it to reveal lazy-loaded content
      await scrollJobDescription(page);

      // Re-check if URL changed during content stabilization (slow navigation)
      if (page.url() !== originalUrl) {
        navigatedAway = true;
        console.log(`      🔀 Navigated to: ${page.url()}`);
      }
    }
  }

  return {
    contentChanged: true,
    extractionPage,
    newTab,
    navigatedAway,
    originalUrl,
  };
}

/**
 * Return to the search page after extracting job details
 * Handles closing new tabs or navigating back
 */
export async function returnToSearchPage(
  page: Page,
  clickResult: ClickResult,
): Promise<void> {
  const { newTab, navigatedAway, originalUrl } = clickResult;

  if (newTab) {
    // Close the new tab - original page is still intact
    console.log(`      🔙 Closing job tab, returning to search`);
    await newTab.close();
    return;
  }

  if (navigatedAway) {
    // Navigate back to search results
    console.log(`      🔙 Navigating back to search results`);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await humanWait(page, 1500);

    // Verify we're back on the search page
    const currentUrl = page.url();
    if (currentUrl !== originalUrl) {
      console.warn(
        `      ⚠️  Back navigation landed on different URL: ${currentUrl}`,
      );
      // Try to navigate directly to the search URL
      await page.goto(originalUrl, { waitUntil: "domcontentloaded" });
      await humanWait(page, 1500);
    }

    // Wait for content to stabilize before re-marking
    await waitForSpaContent(page, {
      maxAttempts: 3,
      pollInterval: 1000,
      minGrowthThreshold: 100,
    });

    // Re-mark clickable elements (DOM was re-rendered after navigation)
    await markClickableElementsInContainer(page, "body");
    return;
  }

  // SPA behavior - dismiss any open modal/panel with Escape
  await page.keyboard.press("Escape").catch(() => {});
  await humanWait(page, 300);
}
