/**
 * Source URL extraction with priority-based resolution
 */

import type { Page } from "playwright";
import { extractSourceUrlFromMeta } from "$lib/server/html";
import { BrowserUseClient } from "$lib/server/browser/use-client";
import { isNavigableHref } from "./click-handler";

/**
 * Source URL extraction method
 */
export type SourceUrlMethod =
  | "meta_tags"
  | "href"
  | "address_bar"
  | "llm_extraction"
  | "browser_use"
  | "none";

/**
 * Source URL extraction result with method used
 */
export interface SourceUrlResult {
  url: string | null;
  method: SourceUrlMethod;
}

/**
 * Context for source URL extraction
 */
export interface SourceUrlContext {
  elementHref: string;
  originalUrl: string;
  navigatedAway: boolean;
  newTab: Page | null;
  extractionPage: Page;
  jobHtml: string;
  llmSourceUrl: string | null;
  browserUseClient?: BrowserUseClient;
}

/**
 * Extract source URL using the priority-based flow:
 * 1. Meta/link tags (canonical, og:url, JSON-LD) - most authoritative
 * 2. Anchor href from job card
 * 3. Address bar URL (if changed after click)
 * 4. LLM extraction from visible content
 * 5. Browser-Use to find share button
 * 6. null if none found
 */
export async function extractSourceUrl(
  ctx: SourceUrlContext,
): Promise<SourceUrlResult> {
  const {
    elementHref,
    originalUrl,
    navigatedAway,
    newTab,
    extractionPage,
    jobHtml,
    llmSourceUrl,
    browserUseClient,
  } = ctx;

  // 1. Meta/link tags (canonical, og:url, JSON-LD) - most authoritative
  const metaUrl = extractSourceUrlFromMeta(jobHtml);
  if (metaUrl) {
    console.log(`      🔗 Source URL (meta tags): ${metaUrl}`);
    return { url: metaUrl, method: "meta_tags" };
  }

  // 2. Anchor href from job card (if navigable)
  if (elementHref && isNavigableHref(elementHref)) {
    const fullUrl = new URL(elementHref, originalUrl).href;
    console.log(`      🔗 Source URL (href): ${fullUrl}`);
    return { url: fullUrl, method: "href" };
  }

  // 3. Address bar URL (if navigated away or opened new tab)
  if (navigatedAway || newTab) {
    const addressBarUrl = extractionPage.url();
    console.log(`      🔗 Source URL (address bar): ${addressBarUrl}`);
    return { url: addressBarUrl, method: "address_bar" };
  }

  // 4. LLM extraction from visible content
  if (llmSourceUrl) {
    console.log(`      🔗 Source URL (LLM): ${llmSourceUrl}`);
    return { url: llmSourceUrl, method: "llm_extraction" };
  }

  // 5. Browser-Use to find share button (expensive fallback)
  if (browserUseClient) {
    try {
      console.log(`      🔍 Searching for share button via Browser-Use...`);
      const result = await browserUseClient.executeTask({
        task:
          'Find the share URL or direct link to this job posting. Look for share buttons, copy link buttons, or similar UI elements that reveal the job\'s unique URL. Return the URL if found, or "NOT_FOUND" if no share functionality exists.',
      });

      if (result.success && result.agent_output) {
        const output = result.agent_output.trim();
        // Check if it looks like a URL and not the "NOT_FOUND" response
        if (
          output !== "NOT_FOUND" &&
          (output.startsWith("http://") || output.startsWith("https://"))
        ) {
          console.log(`      🔗 Source URL (Browser-Use): ${output}`);
          return { url: output, method: "browser_use" };
        }
      }
    } catch (error) {
      console.warn(
        `      ⚠️ Browser-Use share URL search failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // 6. No source URL found
  console.log(`      ⚠️ No source URL found`);
  return { url: null, method: "none" };
}
