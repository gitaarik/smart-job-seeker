# Smart Job Seeker

An intelligent job search and application management platform that helps you
create a detailed profile, discover matching opportunities, and optimize your
job application process with AI assistance.

**Vision:** Create your profile once, automatically match it against scraped job
listings from various platforms, and intelligently manage your entire job search
journey with AI-powered insights.

## Key Features

### Profile & Portfolio

- **Comprehensive Profiles** - Work experience, education, skills, and expertise
- **Personal Portfolio** - Modern, responsive showcase of your professional
  background
- **Data Export** - Export your profile in multiple formats

### Job Scraping & Matching

- **Automated Job Scraping** - Scrape job listings from multiple platforms using
  pre-configured search URLs
- **Dual-Mode Navigation** - Traditional URL-based and modern click-based (SPA)
  navigation
- **Playwright Browser Automation** - Reliable, auto-waiting browser control
  with stealth capabilities
- **CDP Integration** - Chrome DevTools Protocol for detecting clickable
  elements
- **HTML Processing** - Extract and clean job posting data for AI analysis
- **LLM Integration** - AI-powered job data extraction with structured output
- **Smart Matching** - Match your profile against scraped jobs (coming soon)

See [SCRAPING.md](docs/SCRAPING.md) for detailed scraping documentation.

### Application Management

- **Application Tracking** - Organize jobs, interviews, and follow-ups
- **AI-Powered Writing** - Generate cover letters, follow-ups, and thank-you
  notes
- **Interview Prep** - AI-generated answers to application questions
- **Activity Logging** - Track all application activities
- **File Management** - Organize application-related documents

### Technical Highlights

- **Groq AI Integration** - Fast, context-aware content generation
- **Directus CMS** - Headless CMS for content management
- **Webhook System** - Secure integration with Directus Flows
- **JSON Resume** - Standard resume format with PDF export

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### Installation

```bash
# Clone and install
git clone <repository-url>
cd smart-job-seeker
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development environment
npm run dev
```

This starts:

- **Directus CMS** at http://localhost:8055
- **SvelteKit app** at http://localhost:5173
- **PostgreSQL database** on port 5432

## Architecture

### Tech Stack

- **Frontend**: SvelteKit 5, Svelte 5, TypeScript, Tailwind CSS
- **Backend**: Node.js, SvelteKit Server Routes, Prisma ORM
- **Database**: PostgreSQL with Directus CMS
- **AI**: Groq API for LLM features
- **Browser Automation**: Playwright (Chromium) with CDP
- **DevOps**: Docker Compose, Vitest

### Key Modules

**Job Scraping Pipeline** (see [SCRAPING.md](docs/SCRAPING.md))

- `scrapers/scraper.ts` - Login orchestration and CDP handoff
- `scrapers/extraction.ts` - CDP element marking and LLM extraction
- `scrapers/job-data.ts` - Job data processing and database operations
- `browser-use-client.ts` - Browser-Use Python service client
- `cdp-utils.ts` - Chrome DevTools Protocol utilities
- `html-strip.ts` - Clean HTML for LLM processing
- `scripts/scrape-job-sites.ts` - CLI script for running scrapes

**AI Features**

- AI-powered cover letter generation
- Interview question answering
- Iterative content refinement
- Template-based prompt management

See [AI_FEATURES.md](docs/AI_FEATURES.md) for detailed AI documentation.

## Database Schema

Key collections:

- **jobs** - Job listings with multi-select fields for types, experience levels,
  and remote options
- **job_searches** - Search configurations with pre-configured search URLs
- **job_resources** - Additional job-related resources
- **applications** - Job application tracking
- **profiles** - User portfolios
- **ai_chat_templates** - AI prompt templates

Complete schema: `prisma/schema.prisma`

## Development

### Common Commands

```bash
# Development
npm run dev                      # Start all services
npm run dev:reset                # Reset DB with dev seed
npm run dev:restore              # Reset DB from full/smart backup
npm run docker:cli               # Access app container

# Database
npm run docker:update-schema     # Sync Prisma from Directus
npm run docker:db:backup         # Backup database

# Code Quality
npm run check                    # Type checking
npm run test                     # Run tests
npx deno fmt                     # Format code

# Profile Management
npm run docker:export-profile-json
npm run docker:export-profiles-pdf
```

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for complete development guide.

## Testing

```bash
npm run test              # Run all tests (180 tests)
npm run test:watch       # Watch mode
npm run test:ui          # Test UI dashboard
```

- Test coverage for all core modules
- Mocked external dependencies
- Unit and integration tests

See [TESTING.md](docs/TESTING.md) for testing guide.

## Documentation

- **[DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development setup and workflows
- **[AI_FEATURES.md](docs/AI_FEATURES.md)** - AI features and usage
- **[WEBHOOK.md](docs/WEBHOOK.md)** - Webhook integration
- **[TESTING.md](docs/TESTING.md)** - Testing framework
- **[AUTHENTICATION.md](docs/AUTHENTICATION.md)** - Auth system
- **[CLAUDE.md](CLAUDE.md)** - Development notes

## Deployment

Configured for **Vercel** deployment:

```bash
npm run build
```

- `SJS_JWT_SECRET`, `SJS_DATABASE_URL`, `SJS_LLM_API_KEY_GROQ`
- `SJS_WEBHOOK_SECRET`, Directus configuration

## Roadmap

### Current Status ✅

- User authentication and profiles
- Job application tracking with AI assistance
- Interview preparation tools
- **Job scraping infrastructure** (newly added)
- Directus CMS integration

### Next Steps 🚀

- Profile-to-job matching engine
- Smart job recommendations
- Automated application workflow
- Multi-platform scraping expansion

## Contributing

1. Follow code quality standards (lint, format, type check)
2. Write tests for new features
3. Update documentation
4. Ensure all tests pass

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for guidelines.

## License

GNU General Public License v3.0 - see [LICENSE](LICENSE) file.

## About

Built by **Rik Wanders**, Senior Full Stack Developer with 12+ years of
experience.

- **Website:** https://www.rikwanders.tech/
- **GitHub:** https://github.com/gitaarik
- **LinkedIn:** https://www.linkedin.com/in/rik-wanders-software

Built with TypeScript, SvelteKit, PostgreSQL, and Directus CMS.
