/**
 * Site-specific configurations for job scraping
 * Simplified for Playwright's auto-waiting capabilities
 */

import type { Page } from "playwright";

export interface SiteSelectors {
  jobListContainer?: string;
  jobListItem?: string;
  jobTitle?: string;
  jobDescription?: string;
}

export interface SiteConfig {
  // Simplified: just timeout
  timeout?: number;

  // Selectors for validation (optional)
  selectors: SiteSelectors;

  // Custom validation if needed
  validator?: (page: Page) => Promise<boolean>;

  // Navigation type (Phase 3)
  navigationType?: "url" | "click";

  // For click-based navigation (Phase 3)
  clickSelectors?: {
    jobCard?: string;
  };
}

/**
 * Site-specific configurations
 */
const SITE_CONFIGS: Record<string, SiteConfig> = {
  "linkedin.com": {
    timeout: 45000, // LinkedIn is slow
    selectors: {
      jobListContainer: ".jobs-search__results-list",
      jobListItem: ".job-card-container",
      jobTitle: ".job-details-jobs-unified-top-card__job-title",
      jobDescription: ".jobs-description",
    },
    validator: async (page: Page) => {
      // Ensure not on login wall
      const hasJobs = await page.locator(".job-card-container").isVisible()
        .catch(() => false);
      const hasLoginWall = await page.locator(".authwall-join-form")
        .isVisible().catch(() => false);
      return hasJobs && !hasLoginWall;
    },
    navigationType: "url",
  },

  "indeed.com": {
    timeout: 30000,
    selectors: {
      jobListContainer: "#mosaic-provider-jobcards",
      jobListItem: ".job_seen_beacon",
      jobTitle: ".jobTitle",
      jobDescription: ".jobsearch-JobComponent-description",
    },
    navigationType: "url",
  },

  "glassdoor.com": {
    timeout: 30000,
    selectors: {
      jobListContainer: ".JobsList_jobsList__Ey2Vo",
      jobListItem: ".JobCard_jobCard__lpoRV",
      jobTitle: ".JobCard_jobTitle___7I6y",
      jobDescription: ".JobDetails_jobDescription__uW_fK",
    },
    navigationType: "url",
  },

  // Example SPA job site with click-based navigation
  "example-spa-job-site.com": {
    timeout: 30000,
    selectors: {
      jobListContainer: ".job-search-results",
      jobDescription: ".job-detail-panel",
    },
    navigationType: "click",
    validator: async (page: Page) => {
      const hasResults = await page.locator(".job-search-results").isVisible()
        .catch(() => false);
      return hasResults;
    },
  },

  // Default fallback configuration
  "default": {
    timeout: 30000,
    selectors: {},
    navigationType: "url",
  },
};

/**
 * Get site configuration from URL
 */
export function getSiteConfig(url: string): SiteConfig {
  try {
    const hostname = new URL(url).hostname;

    // Check for known sites
    for (const [siteName, config] of Object.entries(SITE_CONFIGS)) {
      if (siteName !== "default" && hostname.includes(siteName)) {
        return config;
      }
    }

    // Return default config
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
