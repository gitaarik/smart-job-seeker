# Development Guide

This guide covers development setup, best practices, and workflows for
contributing to Smart Job Seeker.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

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

   Update `.env` with your configuration:
   - `SJS_APP_URL` - Application URL
   - `SJS_JWT_SECRET` - Secret for JWT tokens
   - `SJS_DATABASE_URL` - PostgreSQL connection string
   - `SJS_SMTP2GO_API_KEY` - Email service API key
   - `SJS_GROQ_API_KEY` - Groq API key for AI features
   - Directus admin credentials and configuration

## Development Workflow

### Starting Development Environment

**Start all services with Docker Compose:**

```bash
npm run dev
```

**Note:** The first startup can take some time

This starts:

- **Directus CMS** on `http://localhost:8055`
- **SvelteKit app** on `http://localhost:5173`
- **PostgreSQL database** on port 5432

### Useful Commands

```bash
# Container access
npm run docker:cli               # Access app container shell
npm run docker:db:cli            # Access PostgreSQL CLI

# Database operations
npm run docker:update-schema     # Sync Prisma schema from DB
npm run docker:db:migrate        # Run database migrations
npm run docker:db:backup         # Backup database
npm run docker:db:restore        # Restore database

# Profile export/import
npm run docker:export-profile-json
npm run docker:export-profile-schema
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
│   │   ├── +page.svelte          # Home page
│   │   ├── portfolio/            # Portfolio section
│   │   ├── resume/               # Resume page
│   │   └── api/                  # API endpoints
│   │       └── webhook/          # Webhook handler
│   ├── lib/
│   │   ├── server/               # Server-side utilities
│   │   │   ├── __tests__/       # Unit tests
│   │   │   ├── ai-chat-*.ts     # AI chat modules
│   │   │   ├── html-*.ts        # HTML utilities
│   │   │   ├── llm.ts           # LLM integration
│   │   │   └── job-scraper.ts
│   │   ├── components/           # Reusable Svelte components
│   │   ├── data/                 # Static data and config
│   │   └── images/               # Image assets
│   ├── app.html                  # Root HTML template
│   ├── app.css                   # Global styles
│   └── hooks.server.ts           # Server hooks
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
├── scripts/                       # Utility scripts
├── docs/                         # Documentation
├── docker-compose.yml            # Docker services configuration
├── Dockerfile                     # SvelteKit app image
└── CLAUDE.md                      # Development notes
```

## Database Management

### Prisma Workflow

The project uses Directus as the source of truth for the database schema.
Changes should be made in Directus, then synchronized to Prisma.

1. **Make changes in Directus** (http://localhost:8055)
2. **Sync Prisma schema**: `npm run docker:update-schema`
3. **Generate Prisma client**: `npx prisma generate`

### Manual Prisma Operations

```bash
npx prisma studio          # View database in UI
npx prisma migrate dev     # Create and apply migrations
npx prisma generate       # Generate Prisma Client
```

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

- Webhook handler tests: `src/routes/api/webhook/__tests__/`
- Server utility tests: `src/lib/server/__tests__/`
- Mocked database calls for isolation

### Writing Tests

When adding new features:

1. Write tests in `__tests__/` directory next to the module
2. Follow existing test patterns (see examples in codebase)
3. Mock external dependencies (database, APIs)
4. Ensure all tests pass before committing

For complete testing guide, see [TESTING.md](TESTING.md).

## Docker Services

### Service Details

**Admin (Directus CMS)**

```bash
docker compose up admin
# Access at http://localhost:8055
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
docker compose logs -f admin
```

## API Development

### Webhook Endpoints

Secure webhook endpoint at `POST /api/webhook` for Directus integration.

**Features:**

- HMAC-SHA256 signature verification
- Multiple event type support
- Batch profile export

**Event Types:**

- `profile.export` - Export profile data and schema
- `item.create` - Item creation handler
- `item.update` - Item update handler
- `item.delete` - Item deletion handler
- `custom.event` - Custom event handler

See [WEBHOOK.md](WEBHOOK.md) for detailed setup.

## Code Quality Standards

### Before Committing

Run these checks:

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

## Deployment

The application is configured for deployment on **Vercel**.

### Build Process

```bash
npm install
npm run build
```

### Environment Variables

Required in production:

- `SJS_JWT_SECRET` - Secure random token
- `SJS_DATABASE_URL` - Production PostgreSQL URL
- `SJS_GROQ_API_KEY` - Groq API credentials
- `SJS_SMTP2GO_API_KEY` - Email service credentials
- `SJS_WEBHOOK_SECRET` - Webhook authentication
- Directus configuration (SJS_ADMIN_SECRET, SJS_ADMIN_EMAIL, etc.)

## Performance Optimization

- **Image Optimization** - Enhanced images with `@sveltejs/enhanced-img`
- **Code Splitting** - Automatic via SvelteKit
- **Lazy Loading** - AOS (Animate on Scroll)
- **CSS Optimization** - Tailwind CSS with PurgeCSS
- **Build Optimization** - Vite for fast builds

## Security

- **HMAC-SHA256** - Webhook signature verification
- **Secure Headers** - Automatic in production
- **Environment Variable Protection** - Sensitive credentials stored securely
- **JWT Authentication** - Secure user sessions

## Contributing

When contributing:

1. Follow the code quality standards (lint, format, type check)
2. Write tests for new features
3. Update documentation if needed
4. Use descriptive commit messages
5. Ensure all tests pass before submitting

## Support

For issues or questions:

- Check existing documentation in `/docs`
- Review test files for usage examples
- Check the CLAUDE.md development notes
- Consult API endpoint examples in authentication docs

## Tech Stack Details

### Frontend

- **SvelteKit 5** - Modern web framework
- **Svelte 5** - Reactive UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **FontAwesome** - Icon library

### Backend

- **Node.js** - JavaScript runtime
- **SvelteKit Server Routes** - API endpoints
- **Prisma** - ORM for PostgreSQL
- **JWT** - Authentication

### Database & CMS

- **PostgreSQL** - Relational database
- **Directus** - Headless CMS
- **Prisma Schema** - Database management

### External Services

- **Groq API** - High-performance LLM inference
- **SMTP2GO** - Email delivery

### DevOps

- **Docker & Docker Compose** - Containerization
- **Vite** - Build tool
- **Vitest** - Testing framework
- **Deno fmt** - Code formatting
