# Job Scraping Architecture

This document describes the hybrid job scraping system that combines Browser-Use
for authentication with Patchright for high-performance data extraction.

## Overview

The scraper uses a **hybrid approach**:

1. **Browser-Use (Python)** - Handles login and authentication via AI agent
2. **Patchright (TypeScript)** - Connects via CDP for fast job extraction
3. **LLM Extraction** - Groq/OpenAI extracts structured data from HTML

This architecture provides the best of both worlds: Browser-Use's intelligent
login handling with Patchright's reliable, fast extraction.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Job Scraping Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    CDP Port 9222    ┌──────────────────────────────┐ │
│  │              │ ◄─────────────────► │                              │ │
│  │  Browser-Use │                     │  Patchright (TypeScript)     │ │
│  │   (Python)   │                     │                              │ │
│  │              │                     │  ├─ CDP Element Marking      │ │
│  │  ├─ Login    │                     │  ├─ HTML Capture             │ │
│  │  ├─ CAPTCHA  │                     │  ├─ LLM Job Extraction       │ │
│  │  └─ 2FA      │                     │  └─ Pagination Handling      │ │
│  │              │                     │                              │ │
│  └──────────────┘                     └──────────────────────────────┘ │
│         │                                          │                    │
│         ▼                                          ▼                    │
│  ┌──────────────┐                     ┌──────────────────────────────┐ │
│  │   Chrome     │                     │      PostgreSQL Database     │ │
│  │  (Headless)  │                     │                              │ │
│  │              │                     │  ├─ jobs                     │ │
│  │  Port 9222   │                     │  ├─ job_searches             │ │
│  │  noVNC 6080  │                     │  └─ job_platforms            │ │
│  └──────────────┘                     └──────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### Core Files

```
src/lib/server/scrapers/
├── job-scraper.ts      # Entry point, login orchestration, CDP handoff
├── click-scraper.ts    # CDP marking, LLM extraction, pagination
├── types.ts            # TypeScript interfaces
└── utils.ts            # Helper functions (formatting, prompts)

src/lib/server/
├── browser-use-client.ts   # Browser-Use Python service client
├── cdp-utils.ts            # Chrome DevTools Protocol utilities
├── html-strip.ts           # Clean HTML for LLM processing
├── scrape-filters.ts       # Job validation and stop conditions
├── pagination-utils.ts     # Pagination detection and navigation
└── page-wait-utils.ts      # SPA content loading detection

browser-use/                # Python service (Docker)
├── browser_controller.py   # Browser-Use agent controller
├── main.py                 # FastAPI endpoints
└── Dockerfile
```

### Entry Points

| File                                     | Purpose                        |
| ---------------------------------------- | ------------------------------ |
| `scripts/scrape-job-sites.ts`            | CLI script for running scrapes |
| `src/lib/server/scrapers/job-scraper.ts` | Main `scrapeJobs()` function   |

## Login Flow

The scraper handles authentication in several ways:

### 1. Proactive Login (Recommended)

When a platform has `login_page_url` and credentials configured:

```
Platform config:
├─ url: "https://linkedin.com"
├─ login_page_url: "https://linkedin.com/login"
└─ credentials (in job_platform_credentials)

Flow:
1. Browser-Use navigates to login_page_url
2. AI agent fills credentials
3. Handles CAPTCHA/2FA if needed
4. Navigates to search URL
5. CDP handoff to Patchright
```

### 2. Session Check Path

When no `login_page_url` is configured:

```
Flow:
1. Browser-Use checks if already logged in
2. If logged in → CDP handoff
3. If not logged in:
   a. Has credentials → Auto-login attempt
   b. No credentials → Manual login via noVNC
```

### 3. Manual Intervention

For CAPTCHA, 2FA, or sites without saved credentials:

```
Flow:
1. Scraper detects login/verification needed
2. Opens noVNC at http://localhost:6080
3. User completes authentication manually
4. Scraper resumes automatically when logged in
```

## Extraction Flow

After successful login, Patchright takes over:

### Phase 1: CDP Connection

```typescript
// Connect to Browser-Use's Chrome instance
const browser = await chromium.connectOverCDP(`http://${cdpHost}:${cdpPort}`);
const page = browser.contexts()[0].pages()[0];
```

### Phase 2: Element Marking

```typescript
// Mark all clickable elements with CDP
const clickableCount = await markClickableElementsInContainer(page, "body");
// Elements get data-extract-clickable-id="1", "2", etc.
```

### Phase 3: LLM Classification

```typescript
// LLM identifies which clickables are job cards
const classifications = await classifyMarkedClickables(html);
// Returns: { 1: "view-details", 2: "action", 3: "view-details", ... }
```

### Phase 4: Job Extraction

```typescript
// LLM extracts job data from search page
const jobs = await extractJobsFromSearchPage(strippedHtml);
// Returns: [{ clickableId: 1, title: "...", company: "...", ... }]

// Click each job to get full details
for (const job of jobs) {
  await page.click(`[data-extract-clickable-id="${job.clickableId}"]`);
  const detailHtml = await page.content();
  const fullData = await extractJobData(detailHtml);
  await upsertJob(fullData, jobUrl, platformId);
}
```

### Phase 5: Pagination

```typescript
// Detect pagination type
const pagination = await detectPaginationStrategy(page);
// Types: "numbered", "next_prev", "load_more", "infinite_scroll", "none"

// Navigate to next page
if (pagination.type === "next_prev") {
  await page.click(pagination.nextButtonSelector);
}
```

## Configuration

### Platform Setup (Directus)

Create platforms in `job_platforms` collection:

| Field            | Description                      |
| ---------------- | -------------------------------- |
| `name`           | Platform name (e.g., "LinkedIn") |
| `url`            | Base URL                         |
| `login_page_url` | Login page URL (optional)        |

Create credentials in `job_platform_credentials`:

| Field      | Description           |
| ---------- | --------------------- |
| `platform` | Link to job_platforms |
| `profile`  | Link to profiles      |
| `username` | Login email/username  |
| `password` | Login password        |

Create searches in `job_searches`:

| Field        | Description                  |
| ------------ | ---------------------------- |
| `name`       | Search name                  |
| `search_url` | Full search URL with filters |
| `platform`   | Link to job_platforms        |
| `status`     | "active" or "inactive"       |

### Environment Variables

```bash
# Browser-Use Service
SJS_BROWSER_USE_URL=http://browser-use:8000  # Python service URL
SJS_BROWSER_USE_TIMEOUT=120000               # Max time for Browser-Use tasks
SJS_BROWSER_USE_SEND_SCREENSHOTS=true        # Send screenshots to LLM
SJS_BROWSER_USE_MAX_JOBS_TO_CLICK=5          # Max jobs per page

# CDP Connection (Hybrid)
SJS_HYBRID_CDP_HOST=localhost                # Chrome host (browser-use in Docker)
SJS_HYBRID_CDP_PORT=9222                     # Chrome debugging port
SJS_HYBRID_LOGIN_TIMEOUT=120000              # Max time for login
SJS_HYBRID_HANDOFF_DELAY=1000                # Delay before Patchright connects

# Scraper Behavior
SJS_SCRAPER_MAX_JOBS_PER_SEARCH=100          # Hard limit per search
SJS_SCRAPER_MAX_JOB_AGE=60                   # Max days old
SJS_SCRAPER_DEBUG_MODE=false                 # Enable verbose logging
SJS_SCRAPER_SAVE_DEBUG_SCREENSHOTS=false     # Save screenshots to disk

# Timing
SJS_SCRAPER_PAGE_LOAD_TIMEOUT=3000           # Wait after navigation
SJS_SCRAPER_CLICK_WAIT_TIMEOUT=1000          # Wait after clicks
SJS_SCRAPER_RATE_LIMIT_DELAY=2000            # Delay between requests

# SPA Content Detection
SJS_SCRAPER_SPA_CONTENT_POLL_ATTEMPTS=3      # Max polls for content
SJS_SCRAPER_SPA_CONTENT_POLL_INTERVAL=2000   # Poll interval (ms)
SJS_SCRAPER_SPA_MIN_CONTENT_GROWTH=500       # Min chars to retry
SJS_SCRAPER_SPA_LLM_RETRY_ATTEMPTS=2         # LLM retry attempts
```

## Usage

### Run All Active Searches

```bash
npm run docker:scrape:jobs
```

### Run Specific Search

```bash
npm run docker:scrape:jobs -- --search-id 1
```

### Re-scrape Single Job

```bash
npm run docker:scrape:jobs -- --job-id 123
```

### Options

| Flag               | Description                    |
| ------------------ | ------------------------------ |
| `--search-id <id>` | Run specific search            |
| `--job-id <id>`    | Re-scrape specific job         |
| `--force`          | Ignore HTML change detection   |
| `--screenshots`    | Enable Browser-Use screenshots |
| `--no-screenshots` | Disable screenshots (default)  |

## Debugging

### noVNC Access

For manual login or debugging:

```
URL: http://localhost:6080
Password: (none by default)
```

Use noVNC when:

- CAPTCHA appears during login
- 2FA/verification code needed
- Debugging page interactions

### View Logs

```bash
# All containers
docker compose logs -f

# Browser-Use service only
docker compose logs -f browser-use

# App container only
docker compose logs -f app
```

### Debug Mode

Enable verbose logging:

```bash
SJS_SCRAPER_DEBUG_MODE=true npm run docker:scrape:jobs -- --search-id 1
```

### Save Screenshots

```bash
SJS_SCRAPER_SAVE_DEBUG_SCREENSHOTS=true npm run docker:scrape:jobs -- --search-id 1
```

Screenshots saved to `debug-screenshots/` directory.

## Troubleshooting

### Login Issues

**CAPTCHA appearing:**

- Open noVNC at http://localhost:6080
- Solve CAPTCHA manually
- Scraper will continue automatically

**2FA/Verification code needed:**

- Open noVNC
- Enter code when prompted
- Press Enter to continue

**Invalid credentials:**

- Check `job_platform_credentials` in Directus
- Verify username/password are correct

### Extraction Issues

**No jobs found:**

- Check if page loaded correctly (noVNC)
- Increase `SJS_SCRAPER_SPA_CONTENT_POLL_ATTEMPTS`
- Check HTML stripping isn't too aggressive

**Wrong elements clicked:**

- LLM may misclassify clickables
- Check `data-extract-clickable-id` attributes in HTML
- Adjust prompts in `ai_chat_prompts` collection

**Pagination not working:**

- Check pagination detection in logs
- Some sites use infinite scroll (handled automatically)
- Verify `scraperPaginationMaxPages` limit

### Connection Issues

**CDP connection failed:**

- Verify Chrome is running on port 9222
- Check `SJS_HYBRID_CDP_HOST` (use `browser-use` in Docker)
- Ensure Browser-Use started successfully

**Browser-Use timeout:**

- Increase `SJS_BROWSER_USE_TIMEOUT`
- Check Browser-Use logs for errors
- Verify LLM API key is set

### Performance Issues

**Scraping too slow:**

- Reduce `SJS_SCRAPER_RATE_LIMIT_DELAY`
- Disable screenshots (`--no-screenshots`)
- Reduce `SJS_BROWSER_USE_MAX_JOBS_TO_CLICK`

**Memory issues:**

- Reduce `SJS_SCRAPER_MAX_JOBS_PER_SEARCH`
- Restart containers between large scrapes

## AI Prompts

The scraper uses prompts from `ai_chat_prompts` collection:

| Request                         | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `browser_use_login_only`        | Login task for Browser-Use            |
| `extract_jobs_from_search_page` | Extract job cards from search results |
| `extract_job_data`              | Extract full job details              |
| `classify_clickables`           | Classify clickable elements           |
| `detect_pagination`             | Detect pagination mechanism           |

## Database Schema

### jobs

| Field             | Type     | Description              |
| ----------------- | -------- | ------------------------ |
| `id`              | int      | Primary key              |
| `title`           | string   | Job title                |
| `job_description` | text     | Full description         |
| `source_url`      | string   | Original URL (unique)    |
| `job_platform`    | int      | Foreign key to platforms |
| `status`          | enum     | hiring, closed, stale    |
| `scrape_count`    | int      | Times scraped            |
| `last_scraped`    | datetime | Last scrape time         |

### job_searches

| Field           | Type     | Description              |
| --------------- | -------- | ------------------------ |
| `id`            | int      | Primary key              |
| `name`          | string   | Search name              |
| `search_url`    | string   | Full search URL          |
| `platform`      | int      | Foreign key to platforms |
| `status`        | enum     | active, inactive         |
| `last_run`      | datetime | Last execution           |
| `stripped_html` | text     | Last captured HTML       |

### job_platforms

| Field            | Type   | Description    |
| ---------------- | ------ | -------------- |
| `id`             | int    | Primary key    |
| `name`           | string | Platform name  |
| `url`            | string | Base URL       |
| `login_page_url` | string | Login page URL |

## Technical Stack

- **Browser Automation:** Patchright (Playwright fork with stealth)
- **AI Login:** Browser-Use (Python)
- **LLM:** Groq API (Llama models) / OpenAI / Gemini
- **Database:** PostgreSQL via Prisma
- **Service Communication:** FastAPI (Python) <-> HTTP Client (TypeScript)
