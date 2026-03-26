/**
 * HTML module - re-exports all HTML processing functionality
 */

// Link and URL extraction
export { extractLinks, extractSourceUrlFromMeta } from "./extract.js";

// HTML stripping for LLM
export { stripHtmlForLlm, type StripHtmlOptions } from "./strip.js";
