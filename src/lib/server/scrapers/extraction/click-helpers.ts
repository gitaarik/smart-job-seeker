/**
 * Helper functions for click-based job scraping
 */

import type { Page } from "playwright";
import { dbDirect } from "$lib/db";
import { config } from "$lib/server/config";
import { stripHtmlForLlm } from "$lib/server/html/strip";
import { markClickableElementsInContainer } from "$lib/server/browser/cdp-utils";
import { waitForSpaContent } from "$lib/server/utils/page-wait";
import { createJobScrapingAiChat } from "$lib/server/ai-chat/job-utils";

/**
 * Metadata for a clickable element
 */
interface ClickableMetadata {
  id: number;
  text: string;
  tagName: string;
  className: string;
}

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Classify a single batch of clickables using LLM
 */
async function classifySingleBatch(
  jobSearchId: number,
  metadata: ClickableMetadata[],
): Promise<Map<number, "view-details" | "action">> {
  const clickablesText = metadata
    .map((c) =>
      `ID ${c.id}: "${c.text}" (${c.tagName}, class="${c.className}")`
    )
    .join("\n");

  const result = await createJobScrapingAiChat<{
    clickables: Array<{ id: number; type: "view-details" | "action" }>;
  }>(jobSearchId, "classify_clickables", { clickables: clickablesText });

  const map = new Map<number, "view-details" | "action">();
  if (result.success && result.response?.clickables) {
    for (const c of result.response.clickables) {
      map.set(c.id, c.type);
    }
  }
  return map;
}

/**
 * Classify marked clickable elements using LLM
 * Determines which elements open job details vs perform actions
 * For large numbers of clickables, batches requests and processes in parallel
 */
export async function classifyMarkedClickables(
  jobSearchId: number,
  page: Page,
): Promise<Map<number, "view-details" | "action">> {
  // 1. Extract metadata for all marked clickables
  const clickableMetadata: ClickableMetadata[] = await page.evaluate(() => {
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

  // 3. Check if batching is needed
  const batchSize = config.scraperClickableClassifyBatchSize;
  let classificationMap: Map<number, "view-details" | "action">;

  if (clickableMetadata.length <= batchSize) {
    // Single batch - use existing logic
    classificationMap = await classifySingleBatch(
      jobSearchId,
      clickableMetadata,
    );
  } else {
    // Multiple batches - process in parallel
    const batches = chunkArray(clickableMetadata, batchSize);
    console.log(
      `      📦 Splitting ${clickableMetadata.length} clickables into ${batches.length} batches`,
    );

    const results = await Promise.all(
      batches.map((batch) => classifySingleBatch(jobSearchId, batch)),
    );

    // Combine results from all batches
    classificationMap = new Map<number, "view-details" | "action">();
    for (const batchResult of results) {
      for (const [id, type] of batchResult) {
        classificationMap.set(id, type);
      }
    }
  }

  // 4. Default unclassified to "view-details"
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
