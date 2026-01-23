/**
 * HTML module - re-exports all HTML processing functionality
 */

// Link and URL extraction
export { extractLinks, extractSourceUrlFromMeta } from "./extract";

// HTML stripping for LLM
export { stripHtmlForLlm } from "./strip";
