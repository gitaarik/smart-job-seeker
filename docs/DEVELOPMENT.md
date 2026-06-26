# Development Guide

This guide covers development setup, best practices, and workflows for
contributing to Smart Job Seeker.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd smart-job-seeker
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Key environment variables:

   - `SJS_DATABASE_URL` - PostgreSQL connection string
   - `SJS_APP_URL_HOST` - Public site URL (default: http://localhost:5173)
   - `SJS_LLM_PROVIDER` - LLM provider (groq, gemini, openai, deepseek, cerebras)
   - `SJS_LLM_API_KEY_GROQ` - Groq API key (default provider)

## Development Workflow

### Starting Development Environment

**Start all services with Docker Compose:**

```bash
npm run dev
```

**Note:** The first startup can take some time

This starts:

- **SvelteKit app** on `http://localhost:5173`
- **PostgreSQL database** on port 5432
- **Adminer** (DB management) on `http://localhost:8080`

### Useful Commands

```bash
# Container access
npm run docker:cli               # Access app container shell
npm run docker:db:cli            # Access PostgreSQL CLI

# Database operations
npx drizzle-kit push             # Push schema changes to DB (dev)
npm run docker:db:migrate:new    # Generate a migration file
npm run docker:db:migrate:deploy # Apply migration files
npm run docker:db:backup         # Backup database
npm run docker:db:restore        # Restore database

# Profile export/import
npm run docker:export-profile-json
npm run docker:export-collected-data
npm run docker:export-profiles-pdf

# Code quality
npm run check                    # Type checking
npm run lint                     # ESLint
npm run format                   # Prettier
npx deno fmt                     # Deno formatter

# Testing
npm run test                     # Run all tests
npm run test:watch              # Watch mode
npm run test:ui                 # Test UI dashboard
```

## Development Guidelines

### TypeScript

- **Strict mode enabled** - Type everything properly
- Use `npx tsx` for running TypeScript scripts (not `node`)
- Use ES Modules (`import`) instead of CommonJS (`require`)
- **Path Aliases** - `$lib` alias is configured for both SvelteKit and scripts:
  - In SvelteKit: Works automatically via `kit.alias` configuration
  - In scripts: Configured via `tsconfig.json` paths and `deno.json` imports
  - Use `$lib/` imports in scripts directory for better maintainability

### Svelte 5

- Use modern Svelte 5 APIs
- Example: `import { page } from '$app/state'` (not legacy `'$app/stores'`)

### Code Quality

- Format code with `npx deno fmt` after changes
- For `.svelte` files: `npx deno fmt --unstable-component`
- Run type checking: `npm run check`
- Run linter: `npm run lint`

### File Operations

- Use `rm -f` instead of `rm` when removing files in scripts

## Project Structure

```
smart-job-seeker/
├── src/
│   ├── routes/                    # SvelteKit pages and API routes
│   │   ├── (app)/                 # Authenticated app UI (profile, jobs, applications)
│   │   ├── (auth)/                # Auth pages (login, signup)
│   │   ├── p/[slug]/              # Public profile pages
│   │   │   └── portfolio/         # Portfolio website
│   │   └── api/                   # API endpoints
│   │       ├── ai/                # AI generation (letters, questions, chats)
│   │       ├── profile/           # Profile endpoints
│   │       ├── jobs/              # Job operations
│   │       └── ...                # Other API routes
│   ├── lib/
│   │   ├── server/                # Server-side utilities
│   │   │   ├── ai-chat/           # AI prompt/response generation
│   │   │   ├── auth/              # Better Auth + API key auth
│   │   │   ├── llm/               # LangChain integration + cache
│   │   │   ├── job/               # Job matching and processing
│   │   │   ├── profile/           # Profile management
│   │   │   ├── queue/             # Background job queues (Redis-backed; consumed by the worker)
│   │   │   ├── schemas/           # Zod AI prompt schemas
│   │   │   └── config.ts          # Centralized configuration
│   │   ├── components/            # Reusable Svelte components
│   │   ├── data/                  # Static data and config
│   │   └── stores/                # Client-side stores (is-human, theme)
│   ├── app.html                   # Root HTML template
│   ├── app.css                    # Global styles
│   └── hooks.server.ts            # Server hooks
├── drizzle/                       # Drizzle migrations and schema
├── scripts/                       # Utility scripts
├── docs/                          # Documentation
├── docker-compose.yml             # Docker services configuration
├── Dockerfile                     # SvelteKit app image
└── CLAUDE.md                      # Development notes
```

## Database Management

### Drizzle Workflow

The project uses Drizzle ORM with the schema defined in `src/lib/server/db/schema.ts`.

1. **Edit schema**: `src/lib/server/db/schema.ts`
2. **Push changes** (dev): `npx drizzle-kit push`
3. **Generate migration** (production): `npx drizzle-kit generate`
4. **Apply migrations**: `npx drizzle-kit migrate`

### Database Scripts

```bash
npm run docker:db:migrate              # Run migrations
npm run docker:db:migrate:new          # Create new migration
npm run docker:db:backup               # Backup database
npm run docker:db:restore              # Restore database
```

## Testing

This project uses **Vitest** for unit and integration testing.

### Running Tests

```bash
npm run test              # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Open test UI dashboard
```

### Test Structure

- Tests live in `__tests__/` directories alongside the code they test
- Server utility tests: `src/lib/server/*/__tests__/`
- API route tests: `src/routes/api/*/__tests__/`
- Mocked database calls for isolation

For the complete testing guide, see [TESTING.md](TESTING.md).

## Docker Services

### Service Details

**Adminer (DB Management)**

```bash
docker compose up adminer
# Access at http://localhost:8080
```

**App (SvelteKit)**

```bash
docker compose up app
# Access at http://localhost:5173
```

**Database (PostgreSQL)**

```bash
docker compose up database
# Port: 5432
# User: postgres
# Database: smartjobseeker
```

### Container Management

```bash
# Run all services
npm run dev

# Stop services
docker compose down

# Access container shell
npm run docker:cli

# View logs
docker compose logs -f app
```

## API Development

### AI Endpoints

AI features are served through direct API routes at `/api/ai/`:

- Letter generation, question answering, follow-up refinement
- Authentication via Better Auth sessions
- Direct request/response flow

## Code Quality Standards

### Before Committing

```bash
npm run check           # Type checking and svelte-check
npm run lint           # ESLint and Prettier
npm run test          # All tests must pass
npx deno fmt          # Format all code
```

### Standards

- TypeScript strict mode enabled
- ESLint with Svelte support
- Prettier for consistent formatting
- Deno formatter for modern code standards
- All tests passing
- No type errors

## Security

- **Better Auth** - Email/password authentication with session management
- **API Key Auth** - For programmatic access (`sjs_` prefix keys)
- **Environment Variable Protection** - Sensitive credentials stored securely

## Contributing

When contributing:

1. Follow the code quality standards (lint, format, type check)
2. Write tests for new features
3. Update documentation if needed
4. Use descriptive commit messages
5. Ensure all tests pass before submitting
