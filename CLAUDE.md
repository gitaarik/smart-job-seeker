# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Core Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production (includes database initialization)
- `npm run preview` - Preview production build
- `npm run check` - Run TypeScript and Svelte type checking
- `npm run check:watch` - Run TypeScript and Svelte type checking in watch mode

## Architecture Overview

### Framework & Deployment

- **SvelteKit** application using Svelte 5 with **TypeScript**
- **Vercel** deployment with `@sveltejs/adapter-vercel`
- **Prisma** database, schema in `prisma/schema.prisma`
- **Tailwind CSS** for styling

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
