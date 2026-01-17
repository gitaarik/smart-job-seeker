/**
 * Patchright Scraper Orchestration
 * High-level wrapper that launches browser, handles login, and delegates to click-scraper
 */

import { launchBrowser } from "../browser-utils";
import { scrapeJobsWithClicks } from "./click-scraper";
import { getSiteConfig } from "../job-site-configs";

/**
 * Scrape jobs using Patchright
 * Matches interface of scrapeJobsWithBrowserUse()
 * @param searchUrl URL of the job search results page
 * @param platformId Platform ID for job storage
 * @param profileId Optional profile ID for credential-based login
 * @returns Number of jobs processed
 */
export async function scrapeJobsWithPatchright(
  searchUrl: string,
  platformId: string,
  profileId?: number,
): Promise<number> {
  console.log(`\n🎭 Using Patchright...`);

  // Launch browser with fingerprint (headed mode for debugging)
  const context = await launchBrowser({ headless: false });

  try {
    const page = await context.newPage();

    // Navigate to search URL
    console.log(`\n🌐 Navigating to: ${searchUrl}`);
    await page.goto(searchUrl);
    await page.waitForLoadState("domcontentloaded");

    // Get site config
    const siteConfig = getSiteConfig(searchUrl);

    // Use click-based scraper (works for both SPAs and traditional sites)
    const result = await scrapeJobsWithClicks(
      page,
      siteConfig,
      searchUrl,
      platformId,
      profileId,
    );
    return result.jobsProcessed;
  } finally {
    // Always close browser context
    await context.close();
  }
}
