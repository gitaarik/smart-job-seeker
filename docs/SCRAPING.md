# Job Scraping Architecture

This document describes the job scraping system that uses Playwright for
browser automation and LLMs for structured data extraction.

## Overview

The scraper uses a **provider-based approach**:

1. **Browser Provider** - Manages the browser session (local Docker Chrome, GoLogin, etc.)
2. **Playwright** - Connects via CDP for login, navigation, and extraction
3. **LLM Extraction** - Groq/OpenAI extracts structured data from HTML

The provider abstraction means the scraper code is the same regardless of
where the browser runs — only the CDP URL changes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Job Scraping Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    CDP Port 9222    ┌──────────────────────────────┐ │
│  │              │ ◄─────────────────► │                              │ │
│  │    Chrome    │                     │  Playwright (TypeScript)     │ │
│  │  Container   │                     │                              │ │
│  │              │                     │  ├─ Login (form detection)   │ │
│  │  ├─ Xvfb    │                     │  ├─ CDP Element Marking      │ │
│  │  ├─ VNC     │                     │  ├─ HTML Capture             │ │
│  │  └─ socat   │                     │  ├─ LLM Job Extraction       │ │
│  │              │                     │  └─ Pagination Handling      │ │
│  └──────────────┘                     └──────────────────────────────┘ │
│         │                                          │                    │
│         ▼                                          ▼                    │
│  ┌──────────────┐                     ┌──────────────────────────────┐ │
│  │   noVNC      │                     │      PostgreSQL Database     │ │
│  │  Port 6080   │                     │                              │ │
│  │  (manual     │                     │  ├─ jobs                     │ │
│  │ intervention)│                     │  ├─ job_searches             │ │
│  │              │                     │  └─ job_platforms            │ │
│  └──────────────┘                     └──────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Browser Providers

The scraper supports multiple browser providers. All converge at the same
point: Playwright connects via a CDP URL.

- **Local** (default) — Chrome runs in a Docker container (`chrome` service).
  Playwright connects directly via CDP.
- **GoLogin** — Cloud browser profiles with fingerprinting. GoLogin API
  provides a CDP URL to connect to.

## Components

### Core Files

```
src/server/scrapers/
├── scraper.ts          # Entry point, login, navigation, CDP handoff
├── extraction/         # CDP marking, LLM extraction, pagination
├── job-data.ts         # Job data processing, DB operations
├── intervention/       # Manual intervention handling (CAPTCHA, 2FA)
├── types.ts            # TypeScript interfaces
└── utils.ts            # Helper functions

src/server/browser/
├── provider.ts         # Browser provider abstraction (Local, GoLogin)
├── cdp-utils.ts        # Chrome DevTools Protocol utilities
├── stealth-utils.ts    # Anti-detection scripts
└── login.ts            # Login form detection and filling

chrome/                 # Docker container (local mode)
├── Dockerfile          # Ubuntu + Chrome + Xvfb + VNC + socat
└── entrypoint.sh       # Chrome launch with CDP flags
```

### Entry Points

| File                                 | Purpose                        |
| ------------------------------------ | ------------------------------ |
| `scripts/scrape-job-sites.ts`        | CLI script for running scrapes |
| `src/server/scrapers/scraper.ts`     | Main `scrapeJobs()` function   |

## Login Flow

The scraper handles authentication using Playwright directly:

### 1. Proactive Login (Recommended)

When a platform has `login_page_url` and credentials configured:

```
Platform config:
├─ url: "https://linkedin.com"
├─ login_page_url: "https://linkedin.com/login"
└─ credentials (in job_platform_credentials)

Flow:
1. Playwright navigates to login_page_url
2. LLM detects login form fields
3. Fills credentials automatically
4. Handles CAPTCHA/2FA via manual intervention if needed
5. Navigates to search URL
```

### 2. Session Check Path

When no `login_page_url` is configured:

```
Flow:
1. Playwright checks if already logged in (URL-based)
2. If logged in → proceed to extraction
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

After successful login:

### Phase 1: CDP Connection

```typescript
// Connect to Chrome via CDP
const browser = await chromium.connectOverCDP(`http://${cdpHost}:${cdpPort}`);
const page = browser.contexts()[0].pages()[0];
```

### Phase 2: Element Marking

```typescript
// Mark all clickable elements with CDP
const clickableCount = await markClickableElementsInContainer(page, "body");
// Elements get data-xxx="1", "2", etc.
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
  await page.click(`[data-xxx="${job.clickableId}"]`);
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
# CDP Connection
SJS_CDP_HOST=localhost                       # Chrome host (chrome in Docker)
SJS_CDP_PORT=9222                            # Chrome debugging port
SJS_LOGIN_TIMEOUT=120000                     # Max time for login

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

| Flag               | Description                  |
| ------------------ | ---------------------------- |
| `--search-id <id>` | Run specific search          |
| `--job-id <id>`    | Re-scrape specific job       |
| `--force`          | Ignore HTML change detection |

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

# Chrome container only
docker compose logs -f chrome

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
- Check `data-xxx` attributes in HTML
- Adjust prompts in prompt-templates.ts

**Pagination not working:**

- Check pagination detection in logs
- Some sites use infinite scroll (handled automatically)
- Verify `scraperPaginationMaxPages` limit

### Connection Issues

**CDP connection failed:**

- Verify Chrome is running on port 9222
- Check `SJS_CDP_HOST` (use `chrome` in Docker)
- Check chrome container logs: `docker compose logs chrome`

### Performance Issues

**Scraping too slow:**

- Reduce `SJS_SCRAPER_RATE_LIMIT_DELAY`

**Memory issues:**

- Reduce `SJS_SCRAPER_MAX_JOBS_PER_SEARCH`
- Restart containers between large scrapes

## AI Prompts

The scraper uses prompts from `prompt-templates.ts`:

| Template                        | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `extract_jobs_from_search_page` | Extract job cards from search results |
| `extract_job_data`              | Extract full job details              |
| `classify_clickables`           | Classify clickable elements           |
| `detect_pagination`             | Detect pagination mechanism           |
| `detect_login_page`             | Detect if page is a login page        |
| `detect_login_fields`           | Find login form field selectors       |

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

- **Browser Automation:** Playwright (via CDP connection)
- **Chrome Container:** Ubuntu + Chrome + Xvfb + VNC + socat (local mode)
- **LLM:** Groq API (Llama models) / OpenAI / Gemini
- **Database:** PostgreSQL via Prisma
