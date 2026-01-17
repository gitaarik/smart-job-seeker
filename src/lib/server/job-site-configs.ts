/**
 * Site-specific configurations for job scraping
 * Minimal config - LLM handles HTML structure detection
 */

export interface SiteConfig {
  timeout?: number;
  navigationType?: "url" | "click";
}

/**
 * Site-specific configurations
 * Only specify what differs from defaults
 */
const SITE_CONFIGS: Record<string, SiteConfig> = {
  "linkedin.com": {
    timeout: 45000, // LinkedIn is slow
    navigationType: "click",
  },

  "indeed.com": {
    timeout: 30000,
    navigationType: "url",
  },

  "glassdoor.com": {
    timeout: 30000,
    navigationType: "url",
  },

  "developers.turing.com": {
    timeout: 30000,
    navigationType: "click",
  },

  // Default fallback configuration
  default: {
    timeout: 30000,
    navigationType: "url",
  },
};

/**
 * Get site configuration from URL
 */
export function getSiteConfig(url: string): SiteConfig {
  try {
    const hostname = new URL(url).hostname;

    for (const [siteName, config] of Object.entries(SITE_CONFIGS)) {
      if (siteName !== "default" && hostname.includes(siteName)) {
        return { ...SITE_CONFIGS.default, ...config };
      }
    }

    return SITE_CONFIGS.default;
  } catch {
    return SITE_CONFIGS.default;
  }
}

/**
 * Get human-readable site name from URL
 */
export function getSiteName(url: string): string {
  try {
    const hostname = new URL(url).hostname;

    if (hostname.includes("linkedin.com")) return "LinkedIn";
    if (hostname.includes("indeed.com")) return "Indeed";
    if (hostname.includes("glassdoor.com")) return "Glassdoor";

    return hostname;
  } catch {
    return "Unknown";
  }
}
