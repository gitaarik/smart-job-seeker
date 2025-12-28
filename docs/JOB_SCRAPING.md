# Job Scraping System

This document describes the job scraping infrastructure built to automatically
extract job listings from various platforms and store them in the database.

## Overview

The job scraping system supports two distinct approaches:

1. **URL-based scraping** - Traditional sites where each job has a unique URL
2. **SPA scraping** - Single Page Applications where jobs appear in modals/drawers

The system consists of five main components:

1. **HTML Extraction** - Extract links from search result pages (URL-based)
2. **CDP Detection** - Detect clickable job elements via Chrome DevTools Protocol (SPA)
3. **HTML Stripping** - Clean HTML for efficient LLM processing
4. **LLM Integration** - AI-powered data extraction with structured output
5. **Job Scraping** - Orchestrate the scraping workflow with pre-configured URLs

## Architecture

### URL-based Scraping (Traditional Sites)

```
Pre-configured Search URL → Job Search Page → HTML Extract → Job Links
                                                                 ↓
                                      Job Posting Page → HTML Strip → LLM Extract → Database
```

### SPA Scraping (Modal-based Sites)

```
Pre-configured Search URL → Job Search Page → CDP Detection → Job Detail Buttons
                                                                       ↓
                                              Click Button → Modal Detection → Extract Modal Content
                                                                                        ↓
                                                                            HTML Strip → LLM Extract → Database
```

### Data Flow

1. **Search URL**: Use pre-configured, complete search URL from `job_searches`
   table
2. **Search Results**: Navigate to search results page
3. **Link Extraction**: Extract individual job posting URLs
4. **Job Fetching**: Fetch each job posting page
5. **HTML Cleaning**: Strip unnecessary HTML elements
6. **AI Extraction**: Use LLM to extract structured job data
7. **Storage**: Upsert job data to database

## Components

### 1. HTML Extraction (`html-extract.ts`)

Extracts links from HTML content using Cheerio.

**Functions:**

```typescript
extractLinks(html: string, pattern?: RegExp): string[]
```

Extracts all links from HTML, optionally filtered by regex pattern.

**Features:**

- Deduplication of URLs
- Optional regex filtering
- Handles malformed HTML gracefully

**Example:**

```typescript
import { extractLinks } from "$lib/server/html-extract";

const html = await fetch("https://jobsite.com/search");
const jobLinks = extractLinks(html, /\/job\//);
// Returns: ['https://jobsite.com/job/123', 'https://jobsite.com/job/456']
```

### 2. HTML Stripping (`html-strip.ts`)

Removes unnecessary HTML elements to minimize token usage for LLM processing.

**Functions:**

```typescript
stripHtmlForLlm(html: string): string
```

Cleans HTML while preserving semantic structure.

**What it removes:**

- Script and style tags
- HTML comments
- Head section
- SVG elements
- Empty elements
- Most attributes (keeps: href, src, alt, title, aria-label)

**What it preserves:**

- Semantic structure (headings, paragraphs, lists)
- Important attributes for context
- Self-closing tags (br, hr, img, input)
- Text content

**Example:**

```typescript
import { stripHtmlForLlm } from "$lib/server/html-strip";

const jobPage = await fetch("https://jobsite.com/job/123");
const cleaned = stripHtmlForLlm(jobPage);
// Returns minimal HTML optimized for LLM analysis
```

### 3. LLM Integration (`llm.ts`)

Generic LLM chat completion interface (currently uses Groq).

**Types:**

```typescript
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, any>;
  };
}

interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
}
```

**Functions:**

```typescript
async generateChatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<string>
```

**Features:**

- Provider-agnostic interface (easy to switch from Groq)
- Structured output support via JSON schemas
- Configurable model, temperature, max tokens
- Error handling for missing content

**Example:**

```typescript
import { generateChatCompletion } from "$lib/server/llm";

const response = await generateChatCompletion([
  { role: "system", content: "Extract job data from HTML" },
  { role: "user", content: cleanedHtml },
], {
  temperature: 0.3,
  responseFormat: {
    type: "json_schema",
    json_schema: {
      name: "job_data",
      strict: true,
      schema: jobDataSchema,
    },
  },
});
```

### 4. Job Scraper (`job-scraper.ts`)

Core library functions for extracting job data from HTML.

**Functions:**

```typescript
async extractJobLinks(searchResultsHtml: string): Promise<string[]>
async extractJobData(jobHtml: string, sourceUrl: string): Promise<JobData>
async upsertJob(jobData: JobData, sourceUrl: string, importSource: string): Promise<{ id: number; created: boolean }>
```

**Features:**

- Uses AI prompt templates from database (`ai_chat_prompts`)
- Structured output extraction
- Automatic job deduplication by URL
- Scrape count tracking
- Error handling and logging

**Job Data Structure:**

```typescript
interface JobData {
  title: string;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  date_posted: Date | null;
  location: string | null;
  remote: string | null;
  experience_level: string | null;
  job_type: string | null;
  salary_range: string | null;
}
```

### 5. CDP Utilities (`cdp-utils.ts`)

Chrome DevTools Protocol utilities for detecting clickable elements in SPAs.

**Functions:**

```typescript
async markClickableElementsInContainer(
  page: Page,
  containerSelector: string = "body"
): Promise<number>
```

Detects and marks all clickable elements with event listeners in a container.

**How it works:**

1. Creates CDP session with the browser page
2. Queries all elements in the specified container
3. For each element:
   - Checks for click event listeners via `DOMDebugger.getEventListeners`
   - Filters out navigation elements (menus, headers, footers)
   - Filters out action buttons (apply, save, share)
   - Identifies job-detail buttons by class names
4. Prioritizes job-detail buttons by sorting them first
5. Marks elements with sequential `data-clickable-id` attributes
6. Adds `data-click-text` for context (e.g., "job-detail-button")

**Element Filtering:**

```typescript
// Excluded patterns
const excludePatterns = [
  "menu", "nav", "header", "footer", "pagination",
  "filter", "sort", "dropdown", "close", "modal", "dialog", "popup"
];

// Excluded button texts
const excludeButtonTexts = [
  "apply", "apply now", "quick apply", "easy apply",
  "save", "share", "bookmark", "refer", "earn"
];

// Job-detail button detection
const isJobDetailButton = className.includes("job-description") ||
  className.includes("job-detail") ||
  className.includes("view-detail") ||
  className.includes("more-info");
```

**Features:**

- Generic framework detection (works across Ant Design, Bootstrap, Material-UI)
- Smart filtering to exclude non-job elements
- Prioritization of high-confidence job buttons
- External link filtering (preserves only # and javascript: hrefs)

### 6. Scraping Script (`scripts/scrape-job-sites.ts`)

Command-line script that orchestrates the complete scraping workflow using
Playwright with support for both URL-based and SPA scraping.

**URL-based Navigation:**

```typescript
// 1. Fetch active job searches with pre-configured URLs
const searchActions = await db.job_searches.findMany({
  where: { status: "active" },
});

// 2. For each search, use the search_url directly
for (const searchAction of searchActions) {
  const searchUrl = searchAction.search_url;

  // Navigate to search page
  await page.goto(searchUrl);

  // Extract job links
  const jobUrls = await extractJobLinks(html);

  // Process each job
  for (const url of jobUrls) {
    const jobData = await extractJobData(jobHtml, url);
    await upsertJob(jobData, url, importSource);
  }
}
```

**SPA Click-based Navigation:**

```typescript
// 1. Use adaptive wait strategy
const waitStrategy = navigationType === "click" ? "load" : "networkidle";
await page.goto(searchUrl, { waitUntil: waitStrategy });

// 2. Detect clickable job elements via CDP
const clickableCount = await markClickableElementsInContainer(page, "body");

// 3. Extract all job-detail-button markers
const jobDetailButtonIds = extractJobDetailButtonIds(markedHtml);

// 4. Click each button and capture modal content
for (const id of jobDetailButtonIds) {
  // Close any existing modals
  await page.keyboard.press("Escape");

  // Click job detail button
  await page.locator(`[data-clickable-id="${id}"]`).click();

  // Detect modal using common selectors
  const modal = await findModal(page, [
    '[role="dialog"]', '.ant-modal', '.MuiDialog-root'
  ]);

  // Extract modal content
  const jobHtml = await modal.innerHTML();
  const jobData = await extractJobData(jobHtml, pseudoUrl);
  await upsertJob(jobData, pseudoUrl, importSource);
}
```

**Key Features:**

- **Dual-mode support** - Automatic detection of URL vs SPA navigation
- **Adaptive wait strategies** - "load" for SPAs, "networkidle" for traditional sites
- **CDP-based detection** - Finds clickable job elements without selectors
- **Generic modal detection** - Works across different UI frameworks
- **Navigation drawer filtering** - Skips user menus and settings
- **PseudoURL support** - Unique identifiers for modal-based jobs (#job-1, #job-2)
- **Platform detection** - Automatically detects platform from URL hostname
- **Persistent browser** - Uses Chrome profile for handling authentication
- **Rate limiting** - Delays between job requests

## Database Schema

### Jobs Collection

The `jobs` collection stores scraped job listings:

**Key Fields:**

- `id` - Primary key
- `title` - Job title
- `job_description` - Job requirements and details
- `company_description` - About the company
- `source_url` - Original job posting URL (unique)
- `import_source` - Platform name (LinkedIn, Indeed, etc.)
- `import_status` - Scraping status (draft, published, error)
- `last_scraped` - Last scrape timestamp
- `scrape_count` - Number of times scraped
- `date_posted` - When job was posted
- `location` - Job location
- `remote_options` - Remote work options (JSON array for multiple selections)
- `experience_levels` - Required experience levels (JSON array for multiple
  selections)
- `job_types` - Employment types (JSON array for multiple selections)
- `salary_range` - Salary information

### Job Searches Collection

The `job_searches` collection stores search configurations with pre-configured
URLs:

**Key Fields:**

- `id` - Primary key
- `name` - Descriptive name (e.g., "LinkedIn - TypeScript - Amsterdam")
- `search_url` - Complete, pre-configured search URL
- `navigation_type` - "url" (default) or "click" for SPA sites
- `profile` - M2O relation to profiles
- `status` - active/inactive
- `last_run` - Last execution timestamp
- `date_created`, `date_updated` - Timestamps

**URL-based Example (Traditional Site):**

```json
{
  "name": "LinkedIn - Senior TypeScript Developer - Remote",
  "search_url": "https://www.linkedin.com/jobs/search/?keywords=Senior%20TypeScript%20Developer&f_WT=2",
  "navigation_type": "url",
  "status": "active"
}
```

**Click-based Example (SPA Site):**

```json
{
  "name": "Turing - AI/ML Jobs",
  "search_url": "https://developers.turing.com/jobs",
  "navigation_type": "click",
  "status": "active"
}
```

### Related Collections

- **job_resources** - Additional resources linked to jobs
- **profiles** - User profiles (linked from job_searches)

### AI Prompt Templates

Scraping uses two prompt templates stored in `ai_chat_prompts`:

**1. `extract_job_links`**

- Extracts job posting URLs from search results
- Returns: Array of URLs

**2. `extract_job_data`**

- Extracts structured data from job posting
- Returns: JobData object

Both templates support:

- Variable interpolation (e.g., `{{html}}`)
- Structured output via `format` field (JSON schema)
- System and user prompts

## Usage

### Manual Scraping Script

The `scripts/scrape-job-sites.ts` script provides a command-line interface:

```bash
npm run docker:cli
npx tsx scripts/scrape-job-sites.ts
```

**How it works:**

1. Reads all active job searches from the `job_searches` table
2. For each search, navigates to the pre-configured `search_url`
3. Extracts job links from the search results page
4. Processes each job (extract data, store in database)
5. Updates the `last_run` timestamp

### Configuration

**Step 1: Create a job search in Directus**

Navigate to the `job_searches` collection and create a new record:

- **Name**: Descriptive label (e.g., "LinkedIn - TypeScript - Amsterdam")
- **Search URL**: Complete search URL from the job platform
- **Navigation Type**: "url" for traditional sites, "click" for SPAs
- **Profile**: Link to your profile
- **Status**: Set to "active"

**URL-based Sites (Traditional):**

- LinkedIn:
  `https://www.linkedin.com/jobs/search/?keywords=TypeScript%20Developer&location=Amsterdam&f_JT=F`
- Indeed: `https://www.indeed.com/jobs?q=Python+Developer&l=Remote&remotejob=1`
- Glassdoor: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=Software+Engineer`

**Click-based Sites (SPAs):**

- Turing: `https://developers.turing.com/jobs`
- Other SPAs where job details appear in modals/drawers

**How to identify if a site is SPA:**

1. Open a job detail - does the URL change?
   - URL changes → Use `navigation_type: "url"`
   - URL stays same, modal appears → Use `navigation_type: "click"`

2. Check network activity - do job details load via AJAX?
   - Full page reload → Use "url"
   - Background API call + modal → Use "click"

**Step 2: Run the scraping script**

```bash
# Run all active searches
npx tsx scripts/scrape-job-sites.ts

# Run specific search by ID
npx tsx scripts/scrape-job-sites.ts --search-id 3
```

### Automated Scraping

For production use, integrate with Directus Flows or cron jobs:

1. **Create Flow** - Schedule-triggered (e.g., daily at 9 AM)
2. **Exec Operation** - Run scraping script:
   `npx tsx scripts/scrape-job-sites.ts`
3. **Notification** - Alert on completion/errors

## Performance Considerations

### HTML Stripping Benefits

Stripping HTML before LLM processing:

- **Reduces tokens** - 50-80% reduction in token count
- **Improves accuracy** - Less noise in extraction
- **Lowers costs** - Fewer tokens = lower API costs
- **Faster processing** - Less data to process

### Batching

For large-scale scraping:

- Process jobs in batches (10-20 at a time)
- Add delays between requests to avoid rate limiting
- Use concurrent processing with limits

```typescript
// Example batch processing
const batchSize = 10;
for (let i = 0; i < jobLinks.length; i += batchSize) {
  const batch = jobLinks.slice(i, i + batchSize);
  await Promise.all(batch.map(processJob));
  await delay(1000); // Rate limiting
}
```

### Deduplication

The system automatically deduplicates by `source_url`:

- Existing jobs are updated with fresh data
- `scrape_count` tracks refresh frequency
- `last_scraped` timestamp for monitoring

## Error Handling

### Common Errors

**1. Prompt Template Not Found**

```
Error: Prompt template 'extract_job_links' not found
```

**Solution**: Create prompt templates in Directus

**2. Invalid JSON Response**

```
Error: Failed to extract job links: Unexpected token
```

**Solution**: Check LLM response format, adjust prompt template

**3. No Content from LLM**

```
Error: No content returned from LLM
```

**Solution**: Check API key, model availability, request format

### Logging

The scraper includes comprehensive error logging:

- Failed parsing attempts logged with response
- Database errors captured
- Source URL included in error messages

## Testing

Comprehensive test coverage (42 tests across 4 modules):

```bash
npm test
```

**Test Files:**

- `html-extract.test.ts` (7 tests)
- `html-strip.test.ts` (13 tests)
- `llm.test.ts` (9 tests)
- `job-scraper.test.ts` (13 tests)

## Future Enhancements

### Planned Features

1. **Multi-platform Support**
   - Indeed scraper
   - Glassdoor scraper
   - More job platforms with pre-configured search URLs

2. **Smart Matching**
   - Profile-to-job matching engine
   - Skill-based recommendations
   - Location and remote work preferences
   - Salary range filtering

3. **Monitoring & Analytics**
   - Scrape success rate tracking
   - Error rate monitoring
   - Performance metrics
   - Job market trend analysis

4. **Optimization**
   - Incremental scraping (only new jobs)
   - Smart refresh scheduling based on job age
   - Improved duplicate detection
   - Parallel scraping for multiple searches

5. **User Experience**
   - Job search template library (common searches)
   - URL builder helper for creating search URLs
   - Job alert notifications
   - Save favorite jobs

## Security & Ethics

### Rate Limiting

Always respect website rate limits:

- Add delays between requests
- Monitor response codes
- Implement exponential backoff

### robots.txt

Check and respect robots.txt:

```bash
curl https://example.com/robots.txt
```

### Terms of Service

Review and comply with:

- Platform terms of service
- Data usage policies
- Scraping restrictions

### Data Privacy

- Store only necessary data
- Respect user privacy
- Comply with GDPR/privacy laws
- Provide data deletion capabilities

## Troubleshooting

### Scraping Returns Empty Results

1. Check HTML structure hasn't changed
2. Verify prompt templates are correct
3. Test with updated HTML samples
4. Check LLM response format

### High Error Rate

1. Review error logs for patterns
2. Test prompts with sample data
3. Adjust temperature for more consistent output
4. Validate JSON schema requirements

### Performance Issues

1. Enable HTML stripping (if not already)
2. Reduce batch size
3. Add request delays
4. Consider using faster LLM model
5. Cache search results

### SPA-specific Issues

**Timeout on page.goto()**

```
Error: page.goto: Timeout 30000ms exceeded
```

**Solution**: SPAs have continuous background activity. The scraper automatically
uses `"load"` wait strategy for click-based navigation.

**No clickable elements found**

```
⚠️  No clickable elements found - page may not be loaded
```

**Possible causes:**
1. Page hasn't fully loaded - increase timeout
2. Job buttons use different class names - check CDP filtering
3. Elements are in shadow DOM - not currently supported

**Wrong elements being clicked**

```
⚠️  Skipping navigation drawer
```

**Solution**: The scraper automatically filters navigation menus. If job buttons
aren't detected, check they have classes like: `job-description`, `job-detail`,
`view-detail`, or `more-info`.

**No modal detected after click**

```
⚠️  No modal found, using full page HTML (may extract wrong job)
```

**Possible causes:**
1. Modal uses non-standard selectors - add to `modalSelectors` array
2. Modal takes time to load - increase wait timeout
3. Modal is actually a route change - use `navigation_type: "url"` instead

**All jobs extracted as duplicates**

**Cause**: PseudoURLs weren't being preserved due to hash fragment stripping.

**Solution**: Already fixed in `normalizeJobUrl()` - pseudoURLs like
`#job-1`, `#job-2` are now preserved.

**Only capturing 5/10 jobs**

**Cause**: LLM was filtering job-detail buttons.

**Solution**: Already fixed - when job-detail buttons are detected, all are used
without LLM filtering.

## References

- [Cheerio Documentation](https://cheerio.js.org/)
- [Groq API Documentation](https://console.groq.com/docs)
- [JSON Schema](https://json-schema.org/)
- [Structured Output Guide](../docs/structured-output-schemas.md)
