# Smart Job Seeker (OSS)

Open-source SvelteKit (Svelte 5 + TypeScript) app with **Drizzle** ORM, PostgreSQL, and Tailwind. Runs via Docker Compose (`app` + `database` containers).

## Database init

- `npm run dev` — if DB has no `profiles` table, restore from `db-dumps/full.sql` or `db-dumps/smart.sql`; else run Drizzle migrations.
- `npm run dev:reset` — drop all tables, load dev seed.
- `npm run dev:restore` — drop all tables, restore from backup.

See `package.json` for container-related scripts.

## Conventions

- TypeScript strict throughout. Use `npx tsx` (not `node`) and ES Modules `import` (not `require`).
- When removing files, use `rm -f`.
- Drizzle schema: `src/lib/server/db/schema.ts`. Generate a migration and apply it — dev runs the same files deploy does (`npx tsx scripts/migrate-deploy.ts`). `scripts/check-migrations.ts` proves the files build what the schema describes, and CI runs it. See `drizzle/README.md` and meta-repo CLAUDE.md.

## AI features and `collected_data`

Every AI prompt (in `src/lib/server/ai-chat/prompt-templates.ts`) is interpolated with `${data}` and `${schema}` from the `collected_data` table. That row is built by `exportProfile()` in `src/lib/server/profile/export.ts` from profile + tech_skills + work_experiences + languages.

- `collected_data` is populated on profile create and lazy-backfilled in `createAndGenerateAiChat`, but it is **not auto-refreshed on every profile edit**. If a user adds a skill and immediately runs an AI feature, they may get a stale snapshot.
- If staleness would be wrong for your feature, call `await exportProfile(profileId)` explicitly before the AI call.
- New AI prompts should use `${data}` (filter via `profileDataFields` if you only need a subset). Don't reinvent profile-summary logic per endpoint.

## Format & tests

```bash
npm run test    # unit (Vitest)
npm run check   # typecheck — svelte-check, NOT raw tsc
```

**Prettier is the formatter.** Run `npm run format` freely — the tree is at a
fixed point and CI gates `prettier --check .`, so an unformatted file fails a
PR.

`.prettierignore` keeps it away from generated output. `drizzle/meta/` matters
most: those are drizzle-kit's migration snapshots and `check-migrations.ts`
builds a database from them, so reformatting them would poke at the check
standing between a broken migration history and a deploy.

Two things worth knowing:

- **Prettier is not always idempotent in one pass.** Formatting the tree took
  two: the first split a Drizzle method chain across lines, which changed the
  line-width arithmetic so the second re-collapsed it. If `--check` still
  complains right after `--write`, run it again rather than hand-editing.
- **Never run `deno fmt`.** deno was the previous half-finished answer here.
  It cannot format `.svelte` at all without `--unstable-component`, and with
  that flag it de-indents every `<script>` block to column 0 — including files
  you never touched. `deno.json` no longer configures `fmt`; its `imports`
  alias is unrelated.

**In CI:** four gates, all in `.github/workflows/test.yml`.

| Gate             | Script                | Baseline          |
| ---------------- | --------------------- | ----------------- |
| `svelte-check`   | `ci/check.sh`         | 31 errors         |
| `scripts/` types | `ci/check-scripts.sh` | 26 errors         |
| eslint           | `ci/check-lint.sh`    | 1,464 errors      |
| prettier         | `prettier --check .`  | zero — no backlog |

The three counts are ratchets: they may only ever go **down**, and each script
nags when the real number drops below its baseline so it cannot quietly creep
back up. New errors fail a PR; the existing backlog is tolerated.

**A count taken in the dev app container is not the count CI sees.**
`docker-compose.yml` bind-mounts cloud's billing overlay over OSS's stubs at
`src/lib/server/billing`, `src/routes/api/billing` and `src/routes/(app)/billing`.
Any tool run inside that container reads the overlay; CI reads the stubs. This
has now produced a wrong eslint baseline (1,508 vs 1,521 — the entire gap is
those paths) and a prettier run that reported clean while 13 files were
unformatted.

Measure with `cloud/scripts/check-oss.sh` instead. It runs these same gates in a
throwaway container with only `./oss` mounted, so it reports what CI reports.
Use it before changing any baseline here.

Within the eslint backlog, two rules are worth reading rather than counting:

- **`svelte/no-at-html-tags`** — all 10 sites were audited 2026-08-07 and are
  sound. A new hit is an unreviewed HTML sink, not backlog, and `/p/[slug]`
  renders user-authored content publicly. Two sites there were injectable until
  that audit.
- **`svelte/require-each-key`** (236) — an unkeyed `{#each}` mismatches
  component state when a list reorders, and this UI has drag-reordering
  throughout. Some of those are latent bugs rather than noise.

## Testing with Playwright MCP

Test user (Alex Morgan, profile ID 12, realistic data):

- Email: `alex.morgan@example.com`
- Password: `testpassword123`

Create once after fresh DB, then back up so future restores include it:

```bash
npm run docker:seed:test-user
npm run docker:db:backup
```
