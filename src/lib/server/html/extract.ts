/**
 * HTML extraction utilities using Cheerio-based parsing
 */

import * as cheerio from "cheerio";
import type { Element } from "domhandler";

/**
 * Extract all links matching a pattern from HTML
 * @param html HTML content to extract links from
 * @param pattern Optional regex pattern to filter links
 * @returns Array of URLs found in the HTML
 */
export function extractLinks(
  html: string,
  pattern?: RegExp,
): string[] {
  const links: string[] = [];
  const $ = cheerio.load(html);

  $("a[href]").each((_: number, elem: Element) => {
    const url = $(elem).attr("href");

    if (!url) return;

    if (pattern && !pattern.test(url)) return;

    if (!links.includes(url)) {
      links.push(url);
    }
  });

  return links;
}

/**
 * Extract source URL from HTML meta tags and structured data.
 * Checks in priority order:
 * 1. <link rel="canonical">
 * 2. <meta property="og:url">
 * 3. JSON-LD structured data URL (@type: JobPosting)
 *
 * @param html Full HTML content (before stripping)
 * @returns The source URL if found, null otherwise
 */
export function extractSourceUrlFromMeta(html: string): string | null {
  const $ = cheerio.load(html);

  // 1. Check <link rel="canonical">
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical && isValidUrl(canonical)) {
    return canonical;
  }

  // 2. Check <meta property="og:url">
  const ogUrl = $('meta[property="og:url"]').attr("content");
  if (ogUrl && isValidUrl(ogUrl)) {
    return ogUrl;
  }

  // 3. Check JSON-LD structured data for JobPosting URL
  const jsonLdUrl = extractUrlFromJsonLd($);
  if (jsonLdUrl) {
    return jsonLdUrl;
  }

  return null;
}

/**
 * Extract URL from JSON-LD structured data.
 * Looks for @type: JobPosting and extracts the url field.
 */
function extractUrlFromJsonLd($: cheerio.CheerioAPI): string | null {
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    const scriptContent = $(scripts[i]).html();
    if (!scriptContent) continue;

    try {
      const data = JSON.parse(scriptContent);

      // Handle single object or array of objects
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Check if this is a JobPosting
        if (
          item["@type"] === "JobPosting" && item.url && isValidUrl(item.url)
        ) {
          return item.url;
        }

        // Check @graph array (common in schema.org structured data)
        if (Array.isArray(item["@graph"])) {
          for (const graphItem of item["@graph"]) {
            if (
              graphItem["@type"] === "JobPosting" && graphItem.url &&
              isValidUrl(graphItem.url)
            ) {
              return graphItem.url;
            }
          }
        }
      }
    } catch {
      // Invalid JSON, skip this script tag
      continue;
    }
  }

  return null;
}

/**
 * Check if a string looks like a valid HTTP(S) URL.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
