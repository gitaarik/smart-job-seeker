/**
 * HTML validation for job scraping
 */

/**
 * Validate job search HTML before processing
 * Checks for common issues like login pages, errors, CAPTCHA, etc.
 */
export function validateJobSearchHtml(html: string): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check minimum content length
  if (html.length < 1000) {
    warnings.push("HTML content suspiciously short (< 1000 chars)");
  }

  // Check for error pages
  if (html.includes("404") || html.toLowerCase().includes("not found")) {
    warnings.push("Error page (404) detected");
  }

  // Check for CAPTCHA
  if (html.toLowerCase().includes("captcha")) {
    warnings.push("CAPTCHA challenge detected");
  }

  // Check for rate limiting
  if (
    html.toLowerCase().includes("rate limit") ||
    html.toLowerCase().includes("too many requests")
  ) {
    warnings.push("Rate limiting detected");
  }

  return { isValid: warnings.length === 0, warnings };
}
