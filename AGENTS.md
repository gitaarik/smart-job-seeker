# Docker Compose Setup

This project uses Docker Compose with these containers:

## `admin`

- **Directus CMS** used to build and manage the data in the database
- Is the source of truth for the database
- Use the Directus MCP server to make changes in the database
- Prisma ORM is used within the Sveltekit app for connecting to the same
  Directus database
- Use `npm run docker:update-schema` to synchronize the prisma schema with the
  database changes made in Directus

## `app`

- **SvelteKit** application using Svelte 5 with **TypeScript**
- **Prisma** ORM, schema in `prisma/schema.prisma`
- **Tailwind CSS** for styling

## `database`

- **PostgreSQL** server that is used by `admin` and `app`

## `browser-use`

- **Browser-Use** Python service for AI-powered browser automation
- Handles login/authentication for job platforms via AI agent
- Exposes Chrome on port 9222 (CDP) for Patchright to connect
- Exposes noVNC on port 6080 for manual intervention (CAPTCHA, 2FA)

## Job Scraping Architecture

The scraper uses a **hybrid approach** (see `docs/SCRAPING.md` for details):

1. **Browser-Use (Python)** handles login via AI agent
2. **Patchright (TypeScript)** connects via CDP for extraction
3. **LLM** extracts structured job data from HTML

Key files:

- `src/lib/server/scrapers/job-scraper.ts` - Entry point, login orchestration
- `src/lib/server/scrapers/click-scraper.ts` - CDP marking, LLM extraction
- `scripts/scrape-job-sites.ts` - CLI script

Run scraper: `npm run docker:scrape:jobs -- --search-id <id>`

Look at the scripts in `package.json` for help executing things in containers.

### Development Notes

- **TypeScript** is enabled throughout the codebase with strict type checking
- Use `npx tsx` for running TypeScript scripts (instead of `node`)
- When creating scripts, use ES Modules `import` instead of CommonJS `require`
- When removing a file, use `rm -f` instead of `rm`
- **Path Aliases**: The `$lib/` alias is configured for use in scripts directory
  - TypeScript: Configured in `tsconfig.json` with paths mapping and includes
  - Deno: Configured in `deno.json` with imports mapping
  - Use `$lib/` imports in scripts for consistency with SvelteKit code

## Code Quality

- Keep try blocks as small as possible, so it only contains code that could
  throw the catched exception
- Ensure unit-tested and clean, properly formatted code
- After making code changes:
  - Run `npm run test` to check if all unit tests still pass
  - Run `npx deno fmt` to format all code consistently
- For `.svelte` files, use `npx deno fmt --unstable-component`
