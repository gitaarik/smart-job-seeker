/**
 * URL normalization for job import deduplication
 * Removes tracking parameters and normalizes URLs for consistent comparison
 */

/**
 * Tracking parameters to remove from URLs for deduplication
 */
const TRACKING_PARAMS = [
  // UTM parameters
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  // Social/ad tracking
  "fbclid",
  "gclid",
  "gclsrc",
  "msclkid",
  "dclid",
  // Generic tracking
  "tracking",
  "ref",
  "source",
  "referrer",
  "referer",
  "_ga",
  "_gl",
  "mc_cid",
  "mc_eid",
];

/**
 * Hostnames that should have all query parameters removed
 * These platforms don't use query params for job identification
 */
const STRIP_ALL_PARAMS_HOSTS = [
  "linkedin.com",
  "www.linkedin.com",
];

/**
 * Normalize a job URL for deduplication purposes
 *
 * - Removes tracking parameters (utm_*, fbclid, gclid, etc.)
 * - For LinkedIn: removes all query parameters
 * - Normalizes URL format
 *
 * @param url - The job URL to normalize
 * @returns Normalized URL string
 */
export function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Check if we should strip all query params for this host
    const shouldStripAll = STRIP_ALL_PARAMS_HOSTS.some(
      (host) =>
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );

    if (shouldStripAll) {
      // Remove all query parameters for platforms like LinkedIn
      parsed.search = "";
    } else {
      // Only remove tracking parameters
      for (const param of TRACKING_PARAMS) {
        parsed.searchParams.delete(param);
      }
    }

    // Remove hash fragment (typically not needed for job identification)
    parsed.hash = "";

    // Normalize to lowercase hostname
    const normalized = parsed.toString();

    // Remove trailing slash for consistency
    return normalized.endsWith("/") && parsed.pathname !== "/"
      ? normalized.slice(0, -1)
      : normalized;
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Check if two URLs refer to the same job after normalization
 *
 * @param url1 - First URL to compare
 * @param url2 - Second URL to compare
 * @returns True if URLs match after normalization
 */
export function areJobUrlsEqual(url1: string, url2: string): boolean {
  return normalizeJobUrl(url1) === normalizeJobUrl(url2);
}
