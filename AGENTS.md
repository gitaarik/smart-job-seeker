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

**There is no working auto-formatter. Match the surrounding file by hand.**

The repo carries three mutually contradictory formatter configs, and none of
them describes the tree:

| Config | Claims | Reality |
|---|---|---|
| `deno.json` `fmt` | deno is the formatter | deno isn't installed; the tree *is* in its style (2-space, double quotes) |
| `.prettierrc` | tabs, single quotes | SvelteKit scaffold leftover; disagrees with every file |
| `npm run format` | `prettier --write .` | would rewrite **881 files** |

So: running `prettier --write` on a file you touched rewrites the whole file and
buries the real diff — a 59-line edit once became 211 changed lines. Running
`deno fmt --unstable-component` on a `.svelte` file de-indents the entire
`<script>` block to column 0, on *every* file including untouched ones. Both end
in `git checkout` and re-applying by hand.

`npm run lint` (`prettier --check . && eslint .`) is in no workflow and fails
hard either way: 881 files fail the format check, and eslint reports ~1,600
errors — 68 of them in vendored `static/vnc/**` that shouldn't be linted at all.

**In CI:** `scripts/ci/check.sh` gates `svelte-check` on an error-count ratchet
(`BASELINE=33`, may only ever go down). New type errors fail a PR; the existing
backlog is tolerated. Lint and format are not gated.

*Cleanup pending — pick one formatter, reformat once, delete the other two
configs, then gate it. Until then, hand-match.*

## Testing with Playwright MCP

Test user (Alex Morgan, profile ID 12, realistic data):

- Email: `alex.morgan@example.com`
- Password: `testpassword123`

Create once after fresh DB, then back up so future restores include it:

```bash
npm run docker:seed:test-user
npm run docker:db:backup
```
