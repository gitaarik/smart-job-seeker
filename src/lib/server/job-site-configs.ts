/**
 * Site-specific configurations for job scraping
 * Defines wait strategies, selectors, and timeouts per job site
 */

import type { Page } from "puppeteer";
import type { WaitStrategy } from "./page-wait-utils";

export interface SiteSelectors {
  jobListContainer?: string;
  jobListItem?: string;
  jobTitle?: string;
  jobDescription?: string;
}

export interface SiteWaitConfig {
  searchPage: WaitStrategy;
  jobDetailPage: WaitStrategy;
  selectors: SiteSelectors;
}

/**
 * Site-specific configurations
 */
const SITE_CONFIGS: Record<string, SiteWaitConfig> = {
  "linkedin.com": {
    searchPage: {
      waitUntil: "networkidle2",
      selectors: [
        ".jobs-search__results-list", // Primary
        ".scaffold-layout__list-container", // Fallback
        ".jobs-search-results", // Older layout
      ],
      timeout: 45000, // LinkedIn is slow
      additionalDelay: 2000,
      validator: async (page: Page) => {
        // Ensure not on login wall
        const hasJobs = await page.$(".job-card-container") !== null;
        const hasLoginWall = await page.$(".authwall-join-form") !== null;
        return hasJobs && !hasLoginWall;
      },
      retryOptions: { maxAttempts: 2, initialDelay: 3000 },
    },
    jobDetailPage: {
      waitUntil: "networkidle2",
      selectors: [
        ".jobs-unified-top-card",
        ".job-details",
        ".jobs-description",
      ],
      timeout: 30000,
      additionalDelay: 1500,
    },
    selectors: {
      jobListContainer: ".jobs-search__results-list",
      jobListItem: ".job-card-container",
      jobTitle: ".job-details-jobs-unified-top-card__job-title",
      jobDescription: ".jobs-description",
    },
  },

  "indeed.com": {
    searchPage: {
      waitUntil: "networkidle2",
      selector: "#mosaic-provider-jobcards",
      timeout: 30000,
      additionalDelay: 1000,
    },
    jobDetailPage: {
      waitUntil: "networkidle2",
      selector: ".jobsearch-JobComponent",
      timeout: 20000,
      additionalDelay: 1000,
    },
    selectors: {
      jobListContainer: "#mosaic-provider-jobcards",
      jobListItem: ".job_seen_beacon",
      jobTitle: ".jobTitle",
      jobDescription: ".jobsearch-JobComponent-description",
    },
  },

  "glassdoor.com": {
    searchPage: {
      waitUntil: "networkidle2",
      selector: ".JobsList_jobsList__Ey2Vo",
      timeout: 30000,
      additionalDelay: 1500,
    },
    jobDetailPage: {
      waitUntil: "networkidle2",
      selector: ".JobDetails_jobDetails__GL_qI",
      timeout: 25000,
      additionalDelay: 1000,
    },
    selectors: {
      jobListContainer: ".JobsList_jobsList__Ey2Vo",
      jobListItem: ".JobCard_jobCard__lpoRV",
      jobTitle: ".JobCard_jobTitle___7I6y",
      jobDescription: ".JobDetails_jobDescription__uW_fK",
    },
  },

  // Default fallback configuration
  "default": {
    searchPage: {
      waitUntil: "networkidle2",
      timeout: 30000,
      additionalDelay: 2000,
    },
    jobDetailPage: {
      waitUntil: "networkidle2",
      timeout: 20000,
      additionalDelay: 1000,
    },
    selectors: {},
  },
};

/**
 * Get site configuration from URL
 */
export function getSiteConfig(url: string): SiteWaitConfig {
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
