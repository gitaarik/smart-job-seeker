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
  $("iframe").remove();
  $("video").remove();
  $("audio").remove();
  $("canvas").remove();

  // Remove common navigation/UI elements that don't contain useful content
  $("nav").remove();
  $("header").remove();
  $("footer").remove();
  $("[role='navigation']").remove();
  $("[role='banner']").remove();
  $("[role='contentinfo']").remove();
  $(".artdeco-modal").remove(); // LinkedIn modals
  $(".global-nav").remove(); // LinkedIn nav
  $("[data-test-modal]").remove(); // Generic modals

  // Remove all images - they take up space and LLM doesn't need them
  $("img").remove();
  $("picture").remove();

  // Remove all forms of hidden content
  $("[hidden]").remove();
  $("[style*='display:none']").remove();
  $("[style*='display: none']").remove();
  $("[aria-hidden='true']").remove();

  // Remove HTML comments (recursively find all comment nodes)
  $("*")
    .contents()
    .filter(function (_: number, node: any) {
      return node.type === "comment";
    })
    .remove();

  // 2. Keep only essential attributes and truncate long values
  const keepAttributes = new Set([
    "href", // Links to jobs
    "type", // Input types (password, email, etc.)
    "data-extract-role", // Semantic markers for LLM extraction
    "data-extract-clickable-id", // Clickable markers for SPA navigation
    "data-extract-click-text", // Click context for SPA navigation
  ]);

  const maxAttrLength = 200; // Truncate long URLs

  $("*").each((_: number, elem: cheerio.Element) => {
    const element = $(elem);
    const attrs = element.attr();

    if (attrs) {
      Object.keys(attrs).forEach((attr) => {
        if (!keepAttributes.has(attr)) {
          element.removeAttr(attr);
        } else {
          // Truncate long attribute values (especially URLs)
          const value = element.attr(attr);
          if (value && value.length > maxAttrLength) {
            element.attr(attr, value.substring(0, maxAttrLength) + "...");
          }
        }
      });
    }
  });

  // 3. Unwrap unnecessary container elements (divs/spans with no attributes)
  $("div, span").each((_: number, elem: cheerio.Element) => {
    const element = $(elem);
    const attrs = element.attr();

    // If element has no attributes, unwrap it (keep children, remove wrapper)
    if (!attrs || Object.keys(attrs).length === 0) {
      element.replaceWith(element.contents());
    }
  });

  // 4. Remove empty elements (except self-closing tags)
  const selfClosingTags = new Set([
    "br",
    "hr",
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
  const maxIterations = 10; // Increased for more thorough cleaning

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    $("*").each((_: number, elem: cheerio.Element) => {
      const element = $(elem);
      const tagName = (elem as any).tagName?.toLowerCase();

      if (selfClosingTags.has(tagName)) return;

      const text = element.text().trim();
      const hasContentChildren =
        element.find("input, br, hr, a, button").length >
          0;

      if (!text && !hasContentChildren) {
        element.remove();
        changed = true;
      }
    });
  }

  // 5. Get HTML and aggressively normalize whitespace
  let cleaned = $.html();

  // Remove all newlines and collapse whitespace
  cleaned = cleaned.replace(/\n/g, "");
  cleaned = cleaned.replace(/\r/g, "");
  cleaned = cleaned.replace(/\t/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ");
  cleaned = cleaned.replace(/>\s+</g, "><");
  cleaned = cleaned.replace(/\s+>/g, ">");
  cleaned = cleaned.replace(/<\s+/g, "<");
  cleaned = cleaned.trim();

  // 6. Truncate if still too large (last resort)
  // Groq model limit: 30k tokens per request
  // Target: ~20k tokens for content = ~80k chars (leaving room for prompt + response)
  const maxChars = 80000;
  if (cleaned.length > maxChars) {
    console.warn(
      `⚠️  HTML too large (${cleaned.length} chars), truncating to ${maxChars} chars`,
    );
    cleaned = cleaned.substring(0, maxChars) + "<!-- Content truncated -->";
  }

  return cleaned;
}
