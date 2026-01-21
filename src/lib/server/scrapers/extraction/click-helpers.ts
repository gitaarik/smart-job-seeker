/**
 * Helper functions for click-based job scraping
 */

import type { Page } from "playwright";
import { dbDirect } from "$lib/db";
import { config } from "$lib/server/config";
import { stripHtmlForLlm } from "$lib/server/html-strip";
import { markClickableElementsInContainer } from "$lib/server/cdp-utils";
import { waitForSpaContent } from "$lib/server/page-wait-utils";
import { createJobScrapingAiChat } from "$lib/server/ai-chat-job-utils";

/**
 * Classify marked clickable elements using LLM
 * Determines which elements open job details vs perform actions
 */
export async function classifyMarkedClickables(
  page: Page,
): Promise<Map<number, "view-details" | "action">> {
  // 1. Extract metadata for all marked clickables
  const clickableMetadata = await page.evaluate(() => {
    const clickables: Array<{
      id: number;
      text: string;
      tagName: string;
      className: string;
    }> = [];
    document.querySelectorAll("[data-extract-clickable-id]").forEach((el) => {
      clickables.push({
        id: parseInt(el.getAttribute("data-extract-clickable-id") || "0"),
        text: el.textContent?.trim().substring(0, 100) || "",
        tagName: el.tagName.toLowerCase(),
        className: el.className || "",
      });
    });
    return clickables;
  });

  // 2. Skip LLM if no clickables or just one
  if (clickableMetadata.length <= 1) {
    return new Map(
      clickableMetadata.map((c) => [c.id, "view-details" as const]),
    );
  }

  // 3. Format for LLM
  const clickablesText = clickableMetadata
    .map((c) =>
      `ID ${c.id}: "${c.text}" (${c.tagName}, class="${c.className}")`
    )
    .join("\n");

  // 4. Call LLM for classification
  const result = await createJobScrapingAiChat<{
    clickables: Array<{ id: number; type: "view-details" | "action" }>;
  }>("classify_clickables", { clickables: clickablesText });

  // 5. Build classification map
  const classificationMap = new Map<number, "view-details" | "action">();
  if (result.success && result.response?.clickables) {
    for (const c of result.response.clickables) {
      classificationMap.set(c.id, c.type);
    }
  }

  // 6. Default unclassified to "view-details"
  for (const c of clickableMetadata) {
    if (!classificationMap.has(c.id)) {
      classificationMap.set(c.id, "view-details");
    }
  }

  return classificationMap;
}

/**
 * Strip action clickables from HTML by removing their data-extract-clickable-id attributes
 */
export function stripActionClickables(
  html: string,
  classifications: Map<number, "view-details" | "action">,
): string {
  let result = html;
  for (const [id, type] of classifications) {
    if (type === "action") {
      // Remove the data-extract-clickable-id attribute for action clickables
      result = result.replace(
        new RegExp(`data-extract-clickable-id="${id}"`, "g"),
        "",
      );
    }
  }
  return result;
}

/**
 * Check if page content is still loading and retry extraction if so.
 * Used when LLM extraction finds no jobs or all invalid jobs - the page might still be loading.
 */
export async function tryContentRetryOnLoad(
  page: Page,
  pageNumber: number,
  extractionAttempt: number,
  maxLlmRetries: number,
  jobSearchId: number | undefined,
  currentSavedHtml: string,
): Promise<{
  shouldRetry: boolean;
  newStrippedHtml: string;
  savedHtml: string;
}> {
  const contentWait = await waitForSpaContent(page, {
    maxAttempts: config.scraperSpaContentPollAttempts,
    pollInterval: config.scraperSpaContentPollInterval,
    minGrowthThreshold: config.scraperSpaMinContentGrowth,
  });

  if (contentWait.totalGrowth >= config.scraperSpaMinContentGrowth) {
    // Content grew - re-capture HTML and retry
    console.log(
      `      ⏳ Content grew ${contentWait.totalGrowth.toLocaleString()} chars, re-extracting...`,
    );

    // Re-mark clickable elements (new elements may have loaded)
    console.log("      📍 Re-marking clickable elements...");
    const newClickableCount = await markClickableElementsInContainer(
      page,
      "body",
    );
    console.log(`      ✓ Found ${newClickableCount} elements`);

    // Re-capture HTML
    const newMarkedHtml = await page.content();
    const newStrippedHtml = stripHtmlForLlm(newMarkedHtml);

    // Update saved HTML if this is page 1
    let savedHtml = currentSavedHtml;
    if (pageNumber === 1) {
      savedHtml = newStrippedHtml;

      // Update database with new stripped HTML
      if (jobSearchId) {
        await dbDirect.job_searches.update({
          where: { id: jobSearchId },
          data: { stripped_html: newStrippedHtml },
        });
      }
    }

    console.log(
      `      🤖 Retry extraction attempt ${extractionAttempt + 1}/${
        maxLlmRetries + 1
      }...`,
    );

    return { shouldRetry: true, newStrippedHtml, savedHtml };
  }

  // Content stabilized - no retry
  return {
    shouldRetry: false,
    newStrippedHtml: "",
    savedHtml: currentSavedHtml,
  };
}
