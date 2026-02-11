# Smart Job Seeker (OSS)

Open-source SvelteKit application for job seeking assistance.

## Docker Compose Setup

This project uses Docker Compose with these containers:

### `admin`
- **Directus CMS** for database management
- Source of truth for the database schema
- Use Directus MCP server or admin UI to make schema changes
- Prisma ORM connects the SvelteKit app to the same database
- After schema changes: `npm run docker:update-schema`
- Field choice labels (for dropdowns/checkboxes) can be retrieved programmatically
  using `getFieldChoiceLabel()` from `$lib/server/directus/field-labels`

### `app`
- **SvelteKit** application using Svelte 5 with **TypeScript**
- **Prisma** ORM, schema in `prisma/schema.prisma`
- **Tailwind CSS** for styling

### `database`
- **PostgreSQL** server

### Database Initialization

**Normal development** (`npm run dev`):
- Checks if the database is already initialized (looks for `profiles` table)
- If empty, restores from `db-dumps/full.sql` or `db-dumps/smart.sql` backup
- If no backup found, runs Prisma migrations

**Reset database** (`npm run dev:reset`):
- Drops all tables and runs Prisma migrations from scratch

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

**Important**: Use Directus admin UI to create/modify database fields, then sync Prisma:
```bash
npm run docker:update-schema
```

Do NOT add database columns directly via SQL - use Directus so fields get proper interface configuration.

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
