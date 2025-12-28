# Job Scraping Architecture

This document describes the job scraping system, including both traditional
URL-based navigation and modern click-based navigation for Single Page
Applications (SPAs).

## Overview

The job scraper supports two navigation modes:

1. **URL-based navigation** - Traditional sites with direct job URLs
2. **Click-based navigation** - SPAs without direct job URLs

Both modes use Playwright for browser automation and LLMs for data extraction.

## Architecture

### Core Components

```
scripts/scrape-job-sites.ts       - Main scraping orchestration
├── scrapeJobSite()               - Dual-mode router
│   ├── scrapeJobsWithUrls()      - URL-based navigation
│   └── scrapeJobsWithClicks()    - Click-based navigation (SPA)
│
src/lib/server/
├── browser-utils.ts              - Playwright browser launch & context
├── cdp-utils.ts                  - Chrome DevTools Protocol utilities
├── job-scraper.ts                - LLM extraction functions
├── job-site-configs.ts           - Site-specific configurations
└── html-strip.ts                 - HTML stripping for LLM
```

### Navigation Mode Selection

The scraper automatically selects the navigation mode based on site
configuration:

```typescript
const siteConfig = getSiteConfig(searchUrl);
const navigationType = siteConfig.navigationType || "url"; // default: "url"

if (navigationType === "click") {
  // SPA mode: Click through job cards
} else {
  // Traditional mode: Navigate to job URLs
}
```

## URL-Based Navigation (Traditional)

**Used for:** LinkedIn, Indeed, Glassdoor, most traditional job boards

### Flow

1. Navigate to search results page
2. Extract HTML and send to LLM
3. LLM identifies job URLs from HTML
4. Navigate to each job URL
5. Extract job data from each page
6. Save to database

### Example Configuration

```typescript
"linkedin.com": {
  timeout: 45000,
  selectors: {
    jobListContainer: ".jobs-search__results-list",
    jobListItem: ".job-card-container",
    jobDescription: ".jobs-description",
  },
  navigationType: "url", // Traditional navigation
  validator: async (page) => {
    const hasJobs = await page.locator(".job-card-container").isVisible();
    const hasLoginWall = await page.locator(".authwall-join-form").isVisible();
    return hasJobs && !hasLoginWall;
  },
}
```

### LLM Prompts

**Prompt:** `extract_job_links`

- **Input:** Stripped HTML from search results
- **Output:** Array of job URLs

**Prompt:** `extract_job_data`

- **Input:** Stripped HTML from job page
- **Output:** Structured job data (title, company, location, etc.)

## Click-Based Navigation (SPAs)

**Used for:** Modern SPAs where jobs don't have unique URLs

### Flow

1. Navigate to search results page
2. **Use CDP to detect clickable elements** (Chrome DevTools Protocol)
3. Mark elements with `data-clickable-id` attributes
4. Extract HTML (markers survive stripping)
5. **LLM identifies job card pattern** from marked elements
6. Click each identified job card
7. Extract job data from detail panel
8. Save to database with synthetic URLs (`#job-1`, `#job-2`, etc.)

### Example Configuration

```typescript
"example-spa-job-site.com": {
  timeout: 30000,
  selectors: {
    jobListContainer: ".job-search-results",
    jobDescription: ".job-detail-panel",
  },
  navigationType: "click", // SPA click-based navigation
  validator: async (page) => {
    const hasResults = await page.locator(".job-search-results").isVisible();
    return hasResults;
  },
}
```

### CDP Click Detection

The scraper uses Chrome DevTools Protocol to find elements with actual event
listeners:

```typescript
// Mark all clickable elements in container
const clickableCount = await markClickableElementsInContainer(
  page,
  ".job-search-results",
);

// Results in HTML like:
// <div data-clickable-id="0" data-click-text="Software Engineer">...</div>
// <div data-clickable-id="1" data-click-text="Product Manager">...</div>
```

**Why CDP?**

- Detects `addEventListener('click', ...)` handlers
- Finds elements with `cursor: pointer` style
- Works with React, Vue, Angular, any framework
- More reliable than guessing from HTML attributes

### LLM Prompts

**Prompt:** `extract_job_click_selectors`

- **Input:** Stripped HTML with `data-clickable-id` markers
- **Output:** Array of clickable IDs that are job cards
- **Purpose:** Identifies repeating job card pattern (excludes pagination,
  filters, etc.)

**Prompt:** `extract_job_data`

- **Input:** Stripped HTML from job detail panel
- **Output:** Structured job data (same as URL mode)

### Synthetic URLs

Since SPAs don't have unique job URLs, the scraper generates synthetic URLs:

```
https://example-spa-job-site.com/jobs?search=engineer#job-1
https://example-spa-job-site.com/jobs?search=engineer#job-2
https://example-spa-job-site.com/jobs?search=engineer#job-3
```

These URLs are used for:

- Job deduplication (same URL = same job)
- HTML change detection (skip if unchanged)
- Database source_url field

## Playwright Benefits

The migration from Puppeteer to Playwright provides:

### Auto-Waiting

Playwright automatically waits for elements to be actionable:

```typescript
// Old Puppeteer approach - custom wait logic required
await smartWait(page, siteConfig.searchPage);
await validateContentLoaded(page, [".job-card"]);

// New Playwright approach - auto-waits built-in
await page.locator(".job-card").click(); // Waits until clickable
await page.locator(".job-description").waitFor({ state: "visible" });
```

### Better Selectors

```typescript
// CSS selectors
page.locator(".job-card");

// Text selectors
page.getByText("Apply Now");

// Role selectors
page.getByRole("button", { name: "Apply" });

// Combined
page.locator(".job-list").getByRole("link");
```

### CDP Access

Direct access to Chrome DevTools Protocol for advanced features:

```typescript
const client = await page.context().newCDPSession(page);
await client.send("DOM.enable");
const { listeners } = await client.send("DOMDebugger.getEventListeners", {
  objectId: object.objectId,
});
```

## Usage

### Running the Scraper

```bash
# Scrape all active job searches
npm run docker:scrape:jobs

# Scrape specific job search by ID
npm run docker:scrape:jobs -- --search-id 1

# Force re-scrape (ignore HTML change detection)
npm run docker:scrape:jobs -- --search-id 1 --force

# Re-scrape specific job by ID
npm run docker:scrape:jobs -- --job-id 123
```

### Manual Login

For sites requiring authentication:

```bash
# Open browser for manual login
npm run docker:login:jobs

# Then run scraper (session is saved)
npm run docker:scrape:jobs -- --search-id 1
```

Browser profile is saved in `chrome-profiles/default/` for session persistence.

## Configuration

### Site Configuration

Add new sites in `src/lib/server/job-site-configs.ts`:

```typescript
export const SITE_CONFIGS: Record<string, SiteConfig> = {
  "mysite.com": {
    timeout: 30000, // Network idle timeout
    navigationType: "url", // "url" | "click"
    selectors: {
      jobListContainer: ".jobs-list", // Optional: container selector
      jobDescription: ".job-details", // Optional: job detail selector
    },
    validator: async (page) => { // Optional: custom validation
      return await page.locator(".jobs-list").isVisible();
    },
  },
};
```

### AI Prompts

Prompts are managed in Directus (`ai_chat_prompts` collection):

1. **extract_job_links** - Extract URLs from search results (URL mode)
2. **extract_job_click_selectors** - Identify job cards from markers (click
   mode)
3. **extract_job_data** - Extract structured data from job page (both modes)
4. **detect_login_page** - Detect if page requires login (both modes)

## Debugging

### Enable Debug Screenshots

```typescript
// In config
scraperSaveDebugScreenshots: true;
```

Screenshots saved to `debug-screenshots/` directory.

### Check HTML Stripping

The HTML stripper preserves certain attributes:

```typescript
// Preserved attributes
data-*              // All data attributes (includes data-clickable-id)
href                // For link extraction
aria-*              // Accessibility attributes

// Removed
class, id, style    // Visual styling
onclick, onload     // Inline handlers (use CDP instead)
```

### Common Issues

**No job links found:**

- Check if site requires login
- Verify selectors in config
- Check for CAPTCHA
- Inspect debug screenshot

**Click-based navigation not working:**

- Verify `navigationType: "click"` in config
- Check if `jobListContainer` selector is correct
- Ensure CDP can access event listeners (Chromium only)
- Verify LLM prompt `extract_job_click_selectors` exists

**Jobs not updating:**

- HTML change detection prevents re-extraction
- Use `--force` flag to override
- Check `source_html_stripped` field in database

## Performance

### Metrics

From Phase 1-3 migration:

| Metric            | Before (Puppeteer)    | After (Playwright)  |
| ----------------- | --------------------- | ------------------- |
| Lines of code     | ~1,389                | ~1,286 (-103 lines) |
| Custom wait logic | ~160 lines            | ~53 lines (-67%)    |
| Dependencies      | 3 packages            | 2 packages          |
| Auto-waiting      | Custom implementation | Built-in            |
| SPA support       | Limited               | Full (click mode)   |

### Optimization Tips

1. **Container scoping** - Use `jobListContainer` to limit CDP search
2. **Parallel searches** - Run multiple searches in separate browser contexts
3. **HTML change detection** - Skip unchanged jobs automatically
4. **Rate limiting** - 2-second delay between jobs (configurable)

## Testing

### Unit Tests

```bash
npm test
```

Tests cover:

- LLM extraction functions
- HTML stripping
- Job upsert logic
- Data validation

### Manual Testing

1. Test URL mode with LinkedIn/Indeed search
2. Test click mode with SPA site
3. Verify login flow persists across sessions
4. Check database for proper job creation/updates

## Future Improvements

Possible enhancements:

- [ ] Pagination support for multi-page results
- [ ] Infinite scroll detection and handling
- [ ] Parallel job extraction (currently sequential)
- [ ] Retry logic for failed extractions
- [ ] Job expiration detection
- [ ] Company logo scraping
- [ ] Salary estimation for listings without salary

## Technical Details

### Stack

- **Browser:** Playwright (Chromium)
- **Language:** TypeScript
- **LLM:** Groq API (Llama models)
- **Database:** PostgreSQL (via Prisma)
- **CMS:** Directus (for prompts and config)

### Key Libraries

```json
{
  "playwright": "^1.49.1",
  "@playwright/test": "^1.49.1",
  "cheerio": "^1.0.0", // HTML parsing
  "commander": "^12.1.0" // CLI
}
```

### File Structure

```
scripts/
  scrape-job-sites.ts           - Main scraper
  login-to-job-sites.ts         - Manual login helper
  export-profiles-pdf.ts        - PDF export (uses Playwright)

src/lib/server/
  browser-utils.ts              - Playwright browser management
  cdp-utils.ts                  - CDP click detection
  job-scraper.ts                - LLM extraction
  job-site-configs.ts           - Site configurations
  html-strip.ts                 - HTML preprocessing
  page-wait-utils.ts            - Advanced wait utilities
```

## License

This scraper is part of the Smart Job Seeker application and follows the same
license.
