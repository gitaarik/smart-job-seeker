# Docker Compose Setup

This project uses Docker Compose with these containers:

## `admin`

- **Directus CMS** used to build and manage the data in the database
- Is the source of truth for the database

## `app`

- **SvelteKit** application using Svelte 5 with **TypeScript**
- **Prisma** ORM, schema in `prisma/schema.prisma`
- **Tailwind CSS** for styling

## `database`

- **PostgreSQL** server that is used by `admin` and `app`

Look at the scripts in `package.json` for help executing things in containers.

### Development Notes

- **TypeScript** is enabled throughout the codebase with strict type checking
- Use `npx tsx` for running TypeScript scripts (instead of `node`)
- When creating scripts, use ES Modules `import` instead of CommonJS `require`
- When removing a file, use `rm -f` instead of `rm`

## Code Quality

- Ensure clean, properly formatted code
- Use modern Svelte 5 APIs: `import { page } from '$app/state'` (not the legacy
  `'$app/stores'`)
- After making code changes, run `npx deno fmt` to format all code consistently
- For `.svelte` files, use `npx deno fmt --unstable-component`
