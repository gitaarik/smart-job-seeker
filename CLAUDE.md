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
| `svelte-check`   | `ci/check.sh`         | zero — no backlog |
| `scripts/` types | `ci/check-scripts.sh` | zero — no backlog |
| eslint           | `ci/check-lint.sh`    | zero — no backlog |
| prettier         | `prettier --check .`  | zero — no backlog |

**No ratchets are left.** All four gates are at zero and fail on any error:
eslint got there on 2026-09-22, the `scripts/` type check on 2026-09-23 and
`svelte-check` on 2026-09-24. Each started as a count that could only go down
while its backlog was worked off; the history is in the scripts. Reading those
backlogs rather than counting them kept turning up live bugs, which is the
argument for never letting a new one start.

**eslint is no longer a ratchet.** It went 1,521 -> 0 between 2026-08-07 and
2026-09-22 and is now a plain gate: any error fails. The `scripts/` type check
followed on 2026-09-23 (189 -> 0 over its life), with the same rule. Do not raise its baseline
to get a PR through — a rule worth disabling is worth disabling on the line,
with the reason next to it. The changed-files reporting is still there, so a
failure names the errors your change added.

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
CI's number: 88 s, and the same count CI reports.

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

Nothing remains. The last ten went on 2026-09-22: eight were fixable, and three
of those were casts that had simply stopped being necessary — a property the
query does select, and three sites already narrowed by the `in` check above
them. Two are kept with a disable and the reason beside them, `z.ZodType<any>`
(zod's output parameter is covariant, so `unknown` makes every caller cast) and
`generateChatCompletion<T = any>` (the default is only reached by callers that
chose not to name a shape).

The comment block in `ci/check-lint.sh` is the real history of how, including
the two wrong turns worth not repeating.

Five rules are worth reading rather than counting:

- **`svelte/no-navigation-without-resolve`** — cleared 2026-09-21, and only ONE
  of the 81 was actually fixable: a ternary between two literal paths in
  `+error.svelte`. The rule does no interprocedural analysis, so a helper that
  resolves internally reports identically to one that never heard of
  `resolve()` — `filterUrl()` in `admin/emails` calls `resolve('/admin/emails')`
  on line 83 and all four of its call sites were flagged anyway. Everything else
  was marked, so **a new hit is now genuinely yours**: check you are not in one
  of the marked buckets before adding to it.

  Where the marks went. 27 external URLs (a scraped posting, a platform's own
  site, a tunnel live view, a link a user typed into their profile) moved to
  `lib/components/ExternalLink.svelte`, which carries one disable — use that
  component for a new external link rather than a bare `<a>`. 11 leaf components
  that exist to render a caller-supplied href, and 14 pages whose sites are all
  one shape, carry a file-scoped disable naming the shape.

  Two mechanics worth knowing. An inline `eslint-disable-next-line` usually does
  NOT work here: the flagged line is normally an `href` attribute inside a
  multi-line element, and a comment cannot sit between attributes. And a
  file-level disable placed above `<script>` is silently ignored — the directive
  has to be **inside** the script block to apply to the markup.

  When you do migrate one: a route id carries its layout group
  (`/(app)/jobs/[id]`), though a plain pathname is accepted for a static link
  with no params; `resolve` is typed against the generated route union, so a
  path that is not a route fails svelte-check. That is how two dead
  `/admin/job-platforms/[id]/discover` links were found. For files under
  `static/`, the helper is `asset()`.

- **`svelte/no-at-html-tags`** — 8 sites, each re-verified 2026-09-21 and each
  now carrying its reason next to the code rather than in a comment here.
  `renderSafeMarkdown` escapes raw HTML tokens to inert text and allowlists
  http/https/mailto (stripping control characters first, so `java\tscript:`
  cannot slip through); `highlightHtml` escapes all five entities before it
  injects its own `<span>`s, which is what makes rendering scraped page HTML
  safe; `linkify` escapes before wrapping http(s) matches. A new hit is an
  unreviewed HTML sink, not backlog, and `/p/[slug]` renders user-authored
  content publicly.

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
- **`@typescript-eslint/no-unused-vars`** — cleared, so a hit is yours. **A
  leading underscore now silences it** (`argsIgnorePattern` and friends, set in
  `eslint.config.js` on 2026-09-22): before that the rule's defaults flagged
  `_userId` anyway, which cost 21 errors in the billing stubs alone and forced
  `const { [key]: _, ...rest }` to be written as copy-then-`delete`. Both work
  now. An unused `$props()` name is the component's public shape and belongs to
  `svelte/no-unused-props` instead. Everything else was a dead import or the
  leftover of a replaced feature, and several marked a half-written one.

## Testing with Playwright MCP

Test user (Alex Morgan, profile ID 12, realistic data):

- Email: `alex.morgan@example.com`
- Password: `testpassword123`

Create once after fresh DB, then back up so future restores include it:

```bash
npm run docker:seed:test-user
npm run docker:db:backup
```
