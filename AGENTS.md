# Smart Job Seeker (OSS)

Open-source SvelteKit application for job seeking assistance.

## Docker Compose Setup

This project uses Docker Compose with these containers:

### `app`
- **SvelteKit** application using Svelte 5 with **TypeScript**
- **Drizzle** ORM, schema in `src/lib/server/db/schema.ts`
- **Tailwind CSS** for styling

### `database`
- **PostgreSQL** server

### Database Initialization

**Normal development** (`npm run dev`):
- Checks if the database is already initialized (looks for `profiles` table)
- If empty, restores from `db-dumps/full.sql` or `db-dumps/smart.sql` backup
- If no backup found, runs Drizzle migrations

**Reset database** (`npm run dev:reset`):
- Drops all tables and loads dev seed

**Restore database** (`npm run dev:restore`):
- Drops all tables and restores from full/smart backup

Look at the scripts in `package.json` for help executing things in containers.

## Development Notes

- **TypeScript** is enabled throughout with strict type checking
- Use `npx tsx` for running TypeScript scripts (instead of `node`)
- Use ES Modules `import` instead of CommonJS `require`
- When removing a file, use `rm -f` instead of `rm`
- **Path Aliases**: `$lib/` alias configured for scripts directory
  - TypeScript: Configured in `tsconfig.json`
  - Deno: Configured in `deno.json`

## Database Changes

Edit `src/lib/server/db/schema.ts` directly, then push changes:
```bash
npx drizzle-kit push
```

## Code Quality

- Keep try/catch blocks minimal
- Run tests after changes: `npm run test`
- Format code: `npx deno fmt`
- For `.svelte` files: `npx deno fmt --unstable-component`

## Bug Fixes

- Focus on fixing the actual problem
- Don't implement workarounds unless explicitly asked

## Code Removal

- Don't leave comments explaining removed code
- Ask before adding removal comments

## Testing with Playwright MCP

Test credentials are available for browser testing (uses Alex Morgan profile with realistic data):

- **Email**: `alex.morgan@example.com`
- **Password**: `testpassword123`
- **Profile**: Alex Morgan (ID 12)

To create the test user (run once after fresh DB):
```bash
npm run docker:seed:test-user
```

After seeding, make a database backup to include the test user in future restores:
```bash
npm run docker:db:backup
```
