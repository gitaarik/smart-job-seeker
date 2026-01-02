# Job Scraping Architecture

This document describes the job scraping system using Browser-Use, an AI-powered
browser automation framework.

## Overview

The job scraper uses **Browser-Use** for autonomous navigation and data
extraction:

- **AI Agent Navigation** - Natural language instructions guide the browser
- **Unified Approach** - Same method for both URL-based and click-based sites
- **Automatic Extraction** - AI extracts structured data directly from pages
- **No Manual Selectors** - Agent finds elements intelligently

Browser-Use replaces the previous Playwright + CDP-based approach with a fully
autonomous AI agent.

## Architecture

### Core Components

```
scripts/scrape-job-sites.ts          - Main scraping orchestration
├── scrapeJobsWithBrowserUse()       - AI-powered scraping (unified)
│
src/lib/server/
├── browser-use-client.ts            - Browser-Use API client
├── job-scraper.ts                   - Job upsert & validation
├── job-site-configs.ts              - Site-specific configurations
└── ai-chat-utils.ts                 - Prompt interpolation
│
browser-use/                         - Python service (Docker)
├── browser_controller.py            - Browser-Use agent controller
├── main.py                          - FastAPI service
└── Dockerfile                       - Browser-Use container
```

## Browser-Use Integration

### How It Works

Browser-Use is a Python library that provides an AI agent capable of:

- Interpreting natural language instructions
- Navigating web pages autonomously
- Finding and clicking elements
- Extracting structured data
- Handling pagination and scrolling

The scraper sends a task description to the Browser-Use service:

```typescript
const task = `
Navigate to ${searchUrl} and extract job listings.
For each job:
- Extract title, company, location, salary, description, etc.
- Return structured JSON data

${navigationInstructions}
`;

const response = await browserUse.executeTask({
  task,
  startUrl: searchUrl,
  maxTime: 180, // 3 minutes max
});
```

### Navigation Modes

Both modes use the same Browser-Use approach with different instructions:

**URL Mode** (Traditional Sites):

```
Navigate through pagination links/buttons to find more jobs.
Stop after finding 20 jobs or 5 pages.
```

**Click Mode** (SPAs):

```
Click on each job card to view details.
Stop after finding 20 jobs.
```

### AI Prompt Configuration

The Browser-Use prompt is stored in Directus (`ai_chat_prompts` collection):

**Prompt:** `extract_job_browser_use`

```
System: You are a job scraper agent. Navigate the page and extract job listings.

User: Navigate to the job search page and find all job postings.
For each job, extract:
- title (string)
- job_description (string)
- company_description (string)
- job_poster (string)
- date_posted (ISO date string)
- location (string)
- remote (string: "yes", "no", "hybrid")
- experience_level (string)
- job_type (string)
- salary information
- skills (array)

Return as JSON array of jobs.

{navigationInstructions}
```

The `{navigationInstructions}` variable is interpolated based on navigation
mode.

### Configuration Example

Site configuration in `job-site-configs.ts`:

```typescript
export const SITE_CONFIGS: Record<string, SiteConfig> = {
  "linkedin.com": {
    timeout: 45000,
    navigationType: "url", // or "click" for SPAs
  },
};
```

Much simpler than before - no selectors needed, Browser-Use finds everything!

## Browser-Use Benefits

The migration to Browser-Use provides significant advantages:

### No Manual Selector Configuration

**Before** (Playwright + CDP):

```typescript
selectors: {
  jobListContainer: ".jobs-search__results-list",
  jobListItem: ".job-card-container",
  jobDescription: ".jobs-description",
  pagination: ".pagination-next",
}
```

**After** (Browser-Use):

```typescript
// No selectors needed - AI finds everything!
timeout: 45000,
navigationType: "url"
```

### Autonomous Navigation

The AI agent:

- Finds job cards automatically
- Handles pagination intelligently
- Adapts to layout changes
- Works with any framework (React, Vue, Angular, vanilla JS)

### Single Prompt for Everything

One prompt template handles:

- Navigation (clicking, scrolling, pagination)
- Data extraction (titles, descriptions, salaries)
- Error handling (login walls, CAPTCHAs)
- Site-specific quirks

### Built on Playwright

Browser-Use uses Playwright internally, so you get:

- Auto-waiting for elements
- Reliable CDP access
- Cross-browser support
- Vision capabilities (with supported LLMs)

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
    timeout: 30000,
    navigationType: "url", // "url" | "click"
  },
};
```

That's it! Browser-Use handles everything else automatically.

### AI Prompts

The main prompt in Directus (`ai_chat_prompts` collection):

**extract_job_browser_use** - Complete navigation and extraction prompt

- Handles both URL and click modes
- Uses `{navigationInstructions}` variable for mode-specific guidance
- Returns structured JSON array of jobs

### Browser-Use Service Configuration

The Python service runs in Docker and accepts these environment variables:

```bash
# .env in browser-use/
SJS_LLM_API_KEY_GROQ=your_groq_api_key_here
SJS_BROWSER_HEADLESS=true  # Set to false for debugging
```

Service configuration in TypeScript:

```typescript
// src/lib/server/config.ts
export const config = {
  browserUseUrl: process.env.SJS_BROWSER_USE_URL || "http://localhost:8000",
  browserUseTimeout: 180000, // 3 minutes
};
```

## Debugging

### Enable Headful Mode

To see what Browser-Use is doing:

```bash
# In .env
SJS_BROWSER_USE_HEADLESS=false
```

The browser window will be visible during scraping.

### Check Browser-Use Logs

```bash
# View Python service logs
docker compose logs -f browser-use

# Or check execution history
# Browser-Use saves action history as animated GIFs
ls browser-use/agent_history.gif
```

### Test the Python Service Directly

```bash
# Test if service is running
curl http://localhost:8000/health

# Execute a simple task
curl -X POST http://localhost:8000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Navigate to google.com and search for jobs",
    "start_url": "https://google.com",
    "max_time": 60
  }'
```

### Common Issues

**Browser-Use service not responding:**

- Check if container is running: `docker compose ps`
- View logs: `docker compose logs browser-use`
- Verify LLM API key is set in `.env` (e.g., `SJS_LLM_API_KEY_GROQ`)

**No jobs extracted:**

- Check prompt template exists in Directus: `extract_job_browser_use`
- Verify navigation mode is set correctly
- Try headful mode to see what's happening
- Check if site requires login

**Extraction timeout:**

- Increase `maxTime` in `scrapeJobsWithBrowserUse()`
- Reduce `scraperMaxJobsPerSearch` for faster completion
- Check for slow-loading sites

**Vision mode disabled warning:**

- Expected behavior - Groq doesn't support vision
- `use_vision=False` is set in `browser_controller.py`
- Agent still works using DOM-based navigation

## Performance

### Browser-Use vs Previous Approach

| Metric                  | Playwright + CDP | Browser-Use        |
| ----------------------- | ---------------- | ------------------ |
| Configuration required  | Extensive        | Minimal            |
| Selector maintenance    | High             | None (AI finds it) |
| Adaptation to changes   | Manual           | Automatic          |
| Multi-framework support | Limited          | Universal          |
| Vision capabilities     | No               | Yes (with GPT-4o)  |

### Optimization Tips

1. **Batch processing** - Run multiple searches sequentially (Browser-Use uses
   one browser instance)
2. **Max time limits** - Set appropriate `maxTime` based on site complexity
3. **Job limits** - Use `scraperMaxJobsPerSearch` to control extraction depth
4. **Headless mode** - Keep `SJS_BROWSER_HEADLESS=true` in production for
   performance

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

- **AI Agent:** Browser-Use (Python)
- **Browser:** Playwright (Chromium) via Browser-Use
- **Language:** TypeScript (Node.js) + Python (Browser-Use service)
- **LLM:** Groq API (Llama models)
- **Database:** PostgreSQL (via Prisma)
- **CMS:** Directus (for prompts and config)
- **Service Communication:** FastAPI (Python) ↔ HTTP Client (TypeScript)

### Key Libraries

**TypeScript:**

```json
{
  "commander": "^12.1.0" // CLI
}
```

**Python (Browser-Use service):**

```txt
browser-use>=0.1.0
playwright>=1.40.0
groq>=0.4.0
fastapi>=0.100.0
uvicorn>=0.20.0
```

### File Structure

```
scripts/
  scrape-job-sites.ts              - Main scraper orchestration

src/lib/server/
  browser-use-client.ts            - Browser-Use API client
  job-scraper.ts                   - Job upsert & validation
  job-site-configs.ts              - Site configurations
  ai-chat-utils.ts                 - Prompt interpolation

browser-use/                       - Python service
  browser_controller.py            - Browser-Use agent controller
  main.py                          - FastAPI endpoints
  Dockerfile                       - Service containerization
  requirements.txt                 - Python dependencies
```

## License

This scraper is part of the Smart Job Seeker application and follows the same
license.
