/**
 * HTML extraction utilities using Cheerio-based parsing
 */

import * as cheerio from "cheerio";

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

  $("a[href]").each((_: number, elem: cheerio.Element) => {
    const url = $(elem).attr("href");

    if (!url) return;

    if (pattern && !pattern.test(url)) return;

    if (!links.includes(url)) {
      links.push(url);
    }
  });

  return links;
}
