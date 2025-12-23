/**
 * HTML stripping utilities for LLM processing
 * Removes unnecessary elements to minimize token usage
 */

import * as cheerio from "cheerio";

/**
 * Strip HTML to minimal content for LLM processing
 * Removes: scripts, styles, comments, unnecessary attributes, whitespace
 * Keeps: semantic structure and important attributes (href, src, alt, title)
 */
export function stripHtmlForLlm(html: string): string {
  // Load HTML into Cheerio
  const $ = cheerio.load(html, {
    decodeEntities: true,
    normalizeWhitespace: true,
  });

  // 1. Remove unwanted elements
  $("script").remove();
  $("style").remove();
  $("head").remove();
  $("svg").remove();
  $("noscript").remove();

  // Remove HTML comments (recursively find all comment nodes)
  $("*")
    .contents()
    .filter(function (_: number, node: any) {
      return node.type === "comment";
    })
    .remove();

  // 2. Keep only important attributes
  const keepAttributes = new Set([
    "href",
    "src",
    "alt",
    "title",
    "aria-label",
    "name",
    "value",
    "type",
  ]);

  $("*").each((_: number, elem: cheerio.Element) => {
    const element = $(elem);
    const attrs = element.attr();

    if (attrs) {
      Object.keys(attrs).forEach((attr) => {
        if (!keepAttributes.has(attr)) {
          element.removeAttr(attr);
        }
      });
    }
  });

  // 3. Remove empty elements (except self-closing tags)
  const selfClosingTags = new Set([
    "br",
    "hr",
    "img",
    "input",
    "meta",
    "link",
    "area",
    "base",
    "col",
    "embed",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  let changed = true;
  let iterations = 0;
  const maxIterations = 5;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    $("*").each((_: number, elem: cheerio.Element) => {
      const element = $(elem);
      const tagName = (elem as any).tagName?.toLowerCase();

      if (selfClosingTags.has(tagName)) return;

      const text = element.text().trim();
      const hasContentChildren = element.find("img, input, br, hr").length > 0;

      if (!text && !hasContentChildren) {
        element.remove();
        changed = true;
      }
    });
  }

  // 4. Get HTML and normalize whitespace
  let cleaned = $.html();
  cleaned = cleaned.replace(/\s+/g, " ");
  cleaned = cleaned.replace(/>\s+</g, "><");
  cleaned = cleaned.trim();

  return cleaned;
}
