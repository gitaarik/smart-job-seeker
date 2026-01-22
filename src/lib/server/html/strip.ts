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

  // Remove form elements - filter checkboxes, search inputs, etc. are noise for job extraction
  $("form").remove();
  $("input").remove();
  $("select").remove();
  $("textarea").remove();
  $("label").remove();
  $("fieldset").remove();
  $("legend").remove();
  $("datalist").remove();
  $("option").remove();
  $("optgroup").remove();

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

  // Whitelist of class name patterns to preserve for LLM context
  // Classes containing these substrings will be kept
  const classWhitelist = [
    // Job-related
    "job",
    "position",
    "vacancy",
    "opening",
    "career",
    // Company/employer
    "company",
    "employer",
    "organization",
    // Title/role
    "title",
    "role",
    "heading",
    // Location
    "location",
    "remote",
    "onsite",
    // Salary
    "salary",
    "compensation",
    "pay",
    // List/card structures
    "card",
    "item",
    "list",
    "result",
    // LinkedIn-specific
    "artdeco",
    "scaffold",
  ];

  const maxAttrLength = 75; // Truncate long URLs (75 chars is enough for domain+path)

  $("*").each((_: number, elem: cheerio.Element) => {
    const element = $(elem);
    const attrs = element.attr();

    if (attrs) {
      Object.keys(attrs).forEach((attr) => {
        if (attr === "class") {
          // Filter classes to only keep those matching whitelist patterns
          const classes = (attrs[attr] || "").split(/\s+/);
          const filteredClasses = classes.filter((cls) =>
            classWhitelist.some((pattern) =>
              cls.toLowerCase().includes(pattern)
            )
          );
          if (filteredClasses.length > 0) {
            element.attr("class", filteredClasses.join(" "));
          } else {
            element.removeAttr("class");
          }
        } else if (!keepAttributes.has(attr)) {
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

  // 3. Remove completely empty elements and flatten unnecessary nesting
  // Run repeatedly until no more changes (handles multiple levels of nesting)
  let changesMade = true;
  let flattenIterations = 0;
  const flattenMaxIterations = 10; // Prevent infinite loops

  while (changesMade && flattenIterations < flattenMaxIterations) {
    changesMade = false;
    flattenIterations++;

    $("div, span").each((_: number, elem: cheerio.Element) => {
      const element = $(elem);
      const attrs = element.attr();
      const hasAttrs = attrs && Object.keys(attrs).length > 0;

      // Remove if completely empty (no attributes, no text, no children)
      if (!hasAttrs && element.contents().length === 0) {
        element.remove();
        changesMade = true;
        return;
      }

      // Flatten unnecessary nesting: if this has no attributes and contains only
      // a single element child (also with no attributes), unwrap this container
      if (!hasAttrs) {
        const children = element.children();
        if (children.length === 1) {
          const child = $(children[0]);
          const childAttrs = child.attr();
          const childHasAttrs = childAttrs &&
            Object.keys(childAttrs).length > 0;

          // Only flatten if child also has no attributes (both are purely structural)
          if (
            !childHasAttrs &&
            (child.prop("tagName") === "DIV" ||
              child.prop("tagName") === "SPAN")
          ) {
            element.replaceWith(element.contents());
            changesMade = true;
          }
        }
      }
    });
  }

  // 4. Remove empty elements (except self-closing tags)
  const selfClosingTags = new Set([
    "br",
    "hr",
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

      // Check if element has any preserved attributes (including whitelisted classes)
      const attrs = element.attr();
      const hasPreservedAttrs = attrs &&
        Object.keys(attrs).some((attr) =>
          keepAttributes.has(attr) || attr === "class"
        );

      // Don't remove elements with preserved attributes (even if empty)
      if (hasPreservedAttrs) return;

      const text = element.text().trim();
      const hasContentChildren = element.find("br, hr, a, button").length > 0;

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
  // Modern LLMs (Llama 4, Gemini, GPT-4, Claude) have 128k+ token context windows
  // Target: ~75k tokens for content = ~300k chars (leaving room for prompt + response)
  const maxChars = 300000;
  if (cleaned.length > maxChars) {
    console.warn(
      `⚠️  HTML too large (${cleaned.length} chars), truncating to ${maxChars} chars`,
    );
    cleaned = cleaned.substring(0, maxChars) + "<!-- Content truncated -->";
  }

  return cleaned;
}
