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
| `scripts/` types | `ci/check-scripts.sh` | 25 errors         |
| eslint           | `ci/check-lint.sh`    | 1,038 errors      |
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

It is also slow — a real `npm ci` every time — and it takes a lock, so two of
them cannot run at once. For a quick answer on the type gate alone, the dev
container works if you give node a little more heap than the default:

```bash
docker compose exec -T -e NODE_OPTIONS=--max-old-space-size=3072 app \
  npx svelte-check --tsconfig ./tsconfig.json
```

At the default (~2 GB) this dies partway through and the gate reports it as a
crash. `svelte-check` is unaffected by the billing overlay, so this number is
CI's number: 88 s and the same 31 errors.

**Do not raise that number "to be safe."** This host has 7.6 GB and about 3.5 GB
free once the stack is up. A heap larger than free RAM does not fail — node
allocates into swap and the machine stops responding at ~400% CPU until it is
rebooted, which a 6144 default here did twice. The cap is a safety limit, not a
performance dial: keeping it below free RAM is what makes an over-large
type-check abort cleanly instead of taking the box down.

**When a gate goes over baseline it now tells you where.** Both `check.sh` and
`check-lint.sh` list the errors in files the change touched before the full
backlog (`scripts/ci/changed-files.sh` works out which). Before that, "4 new"
was followed by forty errors nobody here wrote, and finding the four meant
re-running eslint file by file.

**A `pre-push` hook runs these before the push**, if you have installed it —
`sjs-ops/scripts/install-hooks.sh`, the same one that installs `commit-msg`. It
lints the _lines_ you wrote (file-level gating blocks nearly every push here,
since most files already carry backlog) and runs the type gate whole, because
the failure that motivated it appeared only in files the change never opened.
It fails open when the dev stack is down, and `git push --no-verify` skips it.

What remains is two rules and a handful of deliberate exceptions: 731
`@typescript-eslint/no-explicit-any` (210 of them in test mocks, 128 in
`src/lib/server/profile`) and 224 `svelte/no-navigation-without-resolve`.
Everything else has been worked down. Four rules are worth reading rather than
counting:

- **`svelte/no-at-html-tags`** — all 10 sites were audited 2026-08-07 and are
  sound. A new hit is an unreviewed HTML sink, not backlog, and `/p/[slug]`
  renders user-authored content publicly. Two sites there were injectable until
  that audit.
- **`svelte/require-each-key`** — an unkeyed `{#each}` mismatches component
  state when a list reorders, and this UI has drag-reordering throughout. Nearly
  all were keyed on 2026-09-17. Key by a value only when it cannot repeat (a
  primary key, a hardcoded list): Svelte 5 throws on a duplicate key. Otherwise
  key by index, which is what an unkeyed block already does.
- **`svelte/prefer-svelte-reactivity`**, cleared 2026-09-17. `$state` does not
  proxy `Map`/`Set`/`Date`/`URLSearchParams`, so this code used to reassign a
  fresh copy after each mutation. Those are now `SvelteSet`/`SvelteMap` in a
  `const`, mutated in place. Do the same in new code, and do not wrap them in
  `$state` — `svelte/no-unnecessary-state-wrap` flags that, and the two rules
  will trade errors back and forth if you satisfy only one.
- **`@typescript-eslint/no-unused-vars`** — cleared on 2026-09-17 down to what
  sat in uncommitted files, so a hit is usually yours. Two shapes are not dead
  code and must not be deleted: `const { [key]: _, ...rest }` omits a property
  (this config reports the binding anyway — write copy-then-`delete` instead),
  and an unused `$props()` name is the component's public shape, which is
  `svelte/no-unused-props`. Everything else was a dead import or the leftover of
  a replaced feature, and several marked a half-written one.

## Testing with Playwright MCP

Test user (Alex Morgan, profile ID 12, realistic data):

- Email: `alex.morgan@example.com`
- Password: `testpassword123`

Create once after fresh DB, then back up so future restores include it:

```bash
npm run docker:seed:test-user
npm run docker:db:backup
```
