# Smart Job Seeker

An intelligent job-search and application-management platform: create a detailed
profile once, automatically match it against job listings, and manage your entire
application process with AI assistance.

This repository is the **open-source web application** — the SvelteKit app,
database, matching engine, and AI features. It is one part of a larger product;
the actual job-scraping engine is a separate, closed-source component (see
[Project components](#project-components) below).

## Project components

Smart Job Seeker is built from several components. This repo is the open one:

| Component                        | Open?                                                                                                                               | What it does                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web app** (this repository)    | ✅ open source (GPLv3)                                                                                                              | SvelteKit app + PostgreSQL: profiles & portfolio, job and application management, AI writing features, profile↔job **matching**, and the dashboard that schedules and queues scraping runs.                                                                                                                      |
| **Device client**                | ✅ open source — [`sjs-browser`](https://github.com/gitaarik/sjs-browser), [`sjs-desktop`](https://github.com/gitaarik/sjs-desktop) | Runs a real browser on **your own device** and connects to the SJS servers to receive navigation instructions, which it executes locally against the job sites (CDP bridge, stealth, live view). `sjs-browser` is a headless/Docker build; `sjs-desktop` is a Tauri desktop app. Both are separate public repos. |
| **Scraping / extraction worker** | 🔒 closed source                                                                                                                    | Runs on the SJS servers. Decides how to navigate each job site, streams those instructions to your device client, and performs the **LLM-based job extraction** on the pages it returns.                                                                                                                         |

In other words: this app _orchestrates_ scraping — it manages search tasks,
enqueues runs, ingests results, and matches them against profiles. The browser
that actually visits job sites runs on **your own device** via the open-source
[`sjs-browser`](https://github.com/gitaarik/sjs-browser) /
[`sjs-desktop`](https://github.com/gitaarik/sjs-desktop) clients; those clients
connect to the SJS servers, where the closed-source worker decides how to
navigate each site and extracts the job data with an LLM. That closed worker is
**not** included here.

What that means if you run this repo on its own:

- ✅ Profiles & portfolio, application tracking, AI writing, JSON-Resume/PDF
  export, and profile↔job matching all work against data already in the DB.
- ⚠️ **Live job scraping is not available** without the closed-source worker —
  scraping runs you enqueue will sit in the queue with nothing to process them.

## Features

### Profile & portfolio

- Comprehensive profiles — work experience, education, skills, projects
- Personal portfolio — responsive showcase of your professional background
- Data export — multiple formats, including [JSON Resume](https://jsonresume.org/)
  with PDF output

### Matching & applications

- **Profile↔job matching** — scores jobs against your profile, with an admin
  dashboard and an optional semantic skill-matching layer
- Application tracking — organize jobs, interviews, and follow-ups
- AI-powered writing — generate cover letters, follow-ups, and thank-you notes
- Interview prep — AI-generated answers to application questions
- Activity logging and file management

### Technical highlights

- Multi-provider LLM integration (e.g. Groq, Anthropic, OpenAI, Gemini, DeepSeek)
- Background job queues (scrape / match / re-scrape) backed by Redis
- Type-safe data layer with Drizzle ORM

## Quick start

### Prerequisites

- **Docker & Docker Compose** (the dev environment runs entirely in containers)
- Node.js — only needed for host-side tooling; the version is pinned in `.nvmrc`

### Run

```bash
git clone <repository-url>
cd smart-job-seeker

# Configure environment
cp .env.example .env
# Edit .env with your configuration (DB, JWT secret, LLM API keys, …)

# Start the dev environment (app + database + adminer)
npm run dev
```

This starts:

- **SvelteKit app** — http://localhost:5173
- **PostgreSQL** — port 5432
- **Adminer** (DB UI) — http://localhost:8080

On first run with an empty database, Drizzle migrations are applied
automatically. No sample dataset is bundled with this repository.

## Architecture

### Tech stack

- **Frontend:** SvelteKit 5, Svelte 5, TypeScript, Tailwind CSS
- **Backend:** Node.js, SvelteKit server routes, Drizzle ORM
- **Database:** PostgreSQL (+ Adminer for inspection)
- **Queues:** Redis-backed background jobs
- **AI:** multi-provider LLM abstraction
- **Dev/Ops:** Docker Compose, Vitest

### Key modules (in this repo)

- `src/lib/server/db/` — Drizzle schema and data access (`schema.ts`)
- `src/lib/server/job/` — matching logic (`match-utils.ts`, `matcher-state.ts`,
  `match-trigger.ts`)
- `src/lib/server/queue/` — background job queues that orchestrate scraping and
  matching (`scraper-queue.ts`, `match-queue.ts`, `rescrape-queue.ts`)
- `src/lib/server/ai-chat/` — AI prompt templates and writing features
- `src/lib/server/profile/` — profile export / `collected_data` snapshotting
- `src/routes/` — SvelteKit app and API routes

> The browser that visits job sites runs on your own device via the open-source
> [`sjs-browser`](https://github.com/gitaarik/sjs-browser) /
> [`sjs-desktop`](https://github.com/gitaarik/sjs-desktop) clients; the
> closed-source worker on the SJS servers tells it how to navigate and extracts
> the job data with an LLM. Neither is in this repository.

## Development

```bash
# Development
npm run dev                      # start app + database + adminer
npm run dev:reset                # reset the database
npm run docker:cli               # shell into the app container

# Database (Drizzle)
npx drizzle-kit push             # apply schema changes in dev
npm run docker:db:backup         # back up the local database

# Quality
npm run check                    # type checking
npm run test                     # unit tests (Vitest)
npx deno fmt                     # format
```

See the [docs](docs/) directory for more:

- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — development setup and workflows
- [AI_FEATURES.md](docs/AI_FEATURES.md) — AI features and usage
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture
- [TESTING.md](docs/TESTING.md) — testing framework
- [POWER_USER_GUIDE.md](docs/POWER_USER_GUIDE.md) — hosting a scraping device

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

## About

Built by **Rik Wanders**, Senior Full Stack Developer.

- **Website:** https://www.rikwanders.tech/
- **GitHub:** https://github.com/gitaarik
- **LinkedIn:** https://www.linkedin.com/in/rik-wanders-software
