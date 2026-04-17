# Smart Job Seeker - Architecture Documentation

## Overview

Smart Job Seeker is a SvelteKit application that helps users manage their job
search process. It uses Prisma ORM for data management and LangChain with
multiple LLM providers for generating personalized content.

## Technology Stack

### Frontend

- **SvelteKit 5** - Modern framework with file-based routing
- **Svelte 5** - Component framework with runes ($props, $state, $derived,
  $effect)
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Strict type checking throughout

### Backend

- **SvelteKit Server** - SSR and API routes
- **Prisma ORM** - Database access layer
- **PostgreSQL** - Primary database
- **Better Auth** - Authentication (email/password)
- **Redis** - Background job queues

### AI / LLM

- **LangChain** - LLM abstraction layer
- **Groq** (default), **Gemini**, **OpenAI**, **DeepSeek**, **Cerebras** -
  Configurable LLM providers
- **Zod schemas** - Structured output validation

## Project Structure

```
smart-job-seeker/
├── src/
│   ├── lib/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ProfileDisplay/
│   │   │   ├── contact-info/
│   │   │   └── *.svelte
│   │   ├── data/                  # Static data and types
│   │   ├── server/                # Server-side code
│   │   │   ├── ai-chat/           # AI prompt/response generation
│   │   │   ├── auth/              # Better Auth + API key auth
│   │   │   ├── browser/           # Browser automation
│   │   │   ├── email/             # Email service
│   │   │   ├── export/            # Profile data export/import
│   │   │   ├── html/              # HTML parsing/extraction
│   │   │   ├── job/               # Job matching and processing
│   │   │   ├── llm/               # LangChain LLM integration + cache
│   │   │   ├── middleware/        # Rate limiting
│   │   │   ├── monitoring/        # Error tracking
│   │   │   ├── profile/           # Profile management
│   │   │   ├── queue/             # Redis job queues
│   │   │   ├── resume/            # Resume parsing
│   │   │   ├── schemas/           # Zod AI prompt schemas
│   │   │   ├── uploads/           # File upload handling
│   │   │   ├── utils/             # Retry logic, helpers
│   │   │   ├── validation/        # Request validation schemas
│   │   │   └── config.ts          # Centralized configuration
│   │   ├── stores/                # Client-side stores
│   │   │   ├── is-human.svelte.ts # Bot detection
│   │   │   └── theme.svelte.ts    # Theme management
│   │   └── tools/                 # Shared utilities
│   ├── routes/                    # SvelteKit file-based routing
│   │   ├── api/                   # API endpoints
│   │   │   ├── ai/                # AI generation (letters, questions, chats)
│   │   │   ├── education/         # Education CRUD
│   │   │   ├── jobs/              # Job operations
│   │   │   ├── job-searches/      # Job search management
│   │   │   ├── matcher/           # Job matcher status
│   │   │   ├── media/             # Media uploads
│   │   │   ├── platforms/         # Platform config
│   │   │   ├── profile/           # Profile endpoints
│   │   │   ├── work-experience/   # Work experience CRUD
│   │   │   └── ...                # Other API routes
│   │   ├── dashboard/             # Dashboard UI
│   │   │   ├── applications/      # Applications, letters, salary
│   │   │   ├── jobs/              # Browse, matches, saved, settings
│   │   │   ├── profile/           # Profile editing (experience, education, skills, etc.)
│   │   │   └── ...                # Other dashboard pages
│   │   ├── p/[slug]/              # Public profile pages
│   │   │   └── portfolio/         # Portfolio website
│   │   ├── login/                 # Auth pages
│   │   ├── signup/
│   │   └── ...
│   └── app.css                    # Global styles
├── prisma/
│   └── schema.prisma              # Database schema
├── generated/                     # Prisma generated code
├── scripts/                       # Utility scripts
├── docs/                          # Documentation
└── tests/                         # Test utilities
```

## Key Architecture Patterns

### 1. Svelte 5 Modern Patterns

All components use modern Svelte 5 runes:

- `$props()` for component properties
- `$state()` for reactive state
- `$derived()` for computed values
- `$effect()` for side effects

### 2. AI Generation via API Endpoints

AI features (letter generation, question answering, follow-ups) are served
through direct API routes at `/api/ai/`. This provides:

- Direct request/response flow
- Better error handling
- Dashboard integration

### 3. LLM Provider Abstraction

LLM calls go through LangChain (`src/lib/server/llm/langchain.ts`), which
supports provider switching via the `SJS_LLM_PROVIDER` env var. Responses are
cached using SHA-256 hashes of prompts with configurable TTL.

### 4. Production Reliability

#### Retry Logic

External API calls use exponential backoff with jitter:

```typescript
await withRetry(
  async () => apiCall(),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    shouldRetry: isRetryableError,
  },
);
```

#### Rate Limiting

Token bucket algorithm per client IP for API endpoints.

#### Error Tracking

Structured logging with context via `src/lib/server/monitoring/`.

### 5. Type Safety

#### Prisma Types

Database access is fully typed through Prisma.

#### Zod Validation

Request payloads and AI structured outputs are validated with Zod schemas
(`src/lib/server/schemas/ai-prompt-schemas.ts` and
`src/lib/server/validation/`).

## Data Flow

### 1. AI Content Generation (via API)

```
User Dashboard
    |
POST /api/ai/{letters,questions,chats}
    |
Authentication (Better Auth)
    |
Load profile + job context
    |
Build prompt from template
    |
LLM call (LangChain -> provider)
    |
Cache response
    |
Database update (Prisma)
    |
Response to client
```

### 2. Page Rendering

```
User Request
    |
SvelteKit Route (+page.server.ts)
    |
Auth Guard + Load Function (Prisma query)
    |
Page Component (+page.svelte)
    |
Rendered HTML
```

## Configuration

All configuration is centralized in `src/lib/server/config.ts`. Key settings:

- **LLM**: Provider selection, API keys, model overrides, cache TTL, retry config
- **Database**: PostgreSQL connection via `SJS_DATABASE_URL`
- **Auth**: Better Auth with Prisma adapter
- **Browser**: Chrome path for PDF generation and scraping
- **Scraping**: Cooldown and rate limits
- **Redis**: Host and port for job queues

## Testing Strategy

- **508 tests** across 37 test files
- **Vitest** for unit and integration testing
- Tests colocated in `__tests__/` directories alongside source code
- External services mocked (LLM providers, database)

See [TESTING.md](TESTING.md) for the full testing guide.

## Security

- **Better Auth** - Email/password authentication with session management
- **API Key Auth** - For programmatic access (`sjs_` prefix keys)
- **Rate Limiting** - Per-IP token bucket
- **Zod Validation** - All inputs validated at runtime
- **Prisma** - SQL injection prevention

## Deployment

### Docker Compose (Development)

- `database` - PostgreSQL
- `adminer` - Database management UI
- `app` - SvelteKit development server

### Production

- SvelteKit app deployed with Node adapter
- PostgreSQL database
- Redis for background job queues

## Contributing

When contributing to the codebase:

1. Use Svelte 5 runes patterns (no `export let`)
2. Add TypeScript types for all functions
3. Write tests for new features
4. Run `npx deno fmt` before committing
5. Follow existing code organization

See [TESTING.md](TESTING.md) for testing guidelines.
