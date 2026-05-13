/**
 * HTML stripping utilities for LLM processing
 * Removes unnecessary elements to minimize token usage
 */

import * as cheerio from "cheerio";
import type { Element } from "domhandler";

/**
 * Options for HTML stripping
 */
export interface StripHtmlOptions {
  /**
   * Additional class name patterns to preserve (added to the default whitelist).
   * E.g., ["pagination"] to preserve pagination-related classes.
   */
  extraClassPatterns?: string[];
  /**
   * Keep form/input/select/textarea/label etc. Off by default because they're
   * noise for job extraction. Discovery turns this on so the LLM can identify
   * the search-form inputs it needs to fill.
   */
  keepFormElements?: boolean;
  /**
   * Keep nav/header/[role=navigation]/[role=banner]/.global-nav. Off by default
   * to drop site chrome. Discovery turns this on because some platforms (e.g.
   * LinkedIn) put the primary search box inside the global navigation.
   */
  keepNavigation?: boolean;
}

/**
 * Strip HTML to minimal content for LLM processing
 * Removes: scripts, styles, comments, unnecessary attributes, whitespace
 * Keeps: semantic structure and important attributes (href, src, alt, title)
 */
export function stripHtmlForLlm(
  html: string,
  options: StripHtmlOptions = {},
): string {
  // Load HTML into Cheerio
  const $ = cheerio.load(html);

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
  // EXCEPT pagination-related elements when extraClassPatterns includes pagination patterns
  const preservePagination = options.extraClassPatterns?.some((p) =>
    ["pagination", "pager", "page-nav"].includes(p.toLowerCase())
  );

  if (!options.keepNavigation) {
    // Remove nav elements except those with pagination-related classes or aria-labels
    $("nav").each((_, elem) => {
      const el = $(elem);
      const className = el.attr("class")?.toLowerCase() || "";
      const ariaLabel = el.attr("aria-label")?.toLowerCase() || "";
      const isPagination = className.includes("pagination") ||
        className.includes("pager") ||
        ariaLabel.includes("pagination");
      if (!preservePagination || !isPagination) {
        el.remove();
      }
    });

    $("header").remove();

    // Remove role=navigation elements except pagination
    $("[role='navigation']").each((_, elem) => {
      const el = $(elem);
      const className = el.attr("class")?.toLowerCase() || "";
      const ariaLabel = el.attr("aria-label")?.toLowerCase() || "";
      const isPagination = className.includes("pagination") ||
        className.includes("pager") ||
        ariaLabel.includes("pagination");
      if (!preservePagination || !isPagination) {
        el.remove();
      }
    });

    $("[role='banner']").remove();
    $(".global-nav").remove(); // LinkedIn nav
  }

  $("footer").remove();
  $("[role='contentinfo']").remove();
  $(".artdeco-modal").remove(); // LinkedIn modals
  $("[data-test-modal]").remove(); // Generic modals

  // Remove all images - they take up space and LLM doesn't need them
  $("img").remove();
  $("picture").remove();

  // Remove form elements - filter checkboxes, search inputs, etc. are noise for
  // job extraction. Discovery opts out via keepFormElements so the LLM can see
  // the search-form inputs it needs to identify and fill.
  if (!options.keepFormElements) {
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
  }

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
    "data-xxx", // Clickable markers for SPA navigation
  ]);
  if (options.keepFormElements) {
    // These attributes carry the semantic identity of a form input —
    // discovery needs them to tell the LLM which input is "keywords" vs
    // "location" vs "submit".
    keepAttributes.add("placeholder");
    keepAttributes.add("name");
    keepAttributes.add("id");
    keepAttributes.add("aria-label");
    keepAttributes.add("aria-labelledby");
    keepAttributes.add("role");
    keepAttributes.add("value");
  }

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
    // Extra patterns from options
    ...(options.extraClassPatterns || []),
  ];

  const maxAttrLength = 75; // Truncate long URLs (75 chars is enough for domain+path)

  $("*").each((_, elem) => {
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

    $("div, span").each((_, elem) => {
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

    $("*").each((_, elem) => {
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
      // Form elements like <input> carry no text and have no children, so a
      // container DIV around them looks "empty" and would get pruned, taking
      // the input with it. When the caller is keeping form elements, count
      // them as content too.
      const contentChildSelector = options.keepFormElements
        ? "br, hr, a, button, input, select, textarea"
        : "br, hr, a, button";
      const hasContentChildren = element.find(contentChildSelector).length > 0;

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
