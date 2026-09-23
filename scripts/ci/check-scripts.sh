#!/usr/bin/env bash
set -euo pipefail

# Type-check gate for scripts/ — the sibling of check.sh, which covers the app.
#
# scripts/ was type-checked by nothing at all. SvelteKit's generated
# .svelte-kit/tsconfig.json includes src/, test/ and tests/, and TypeScript
# does not merge `include` from an extended config, so the directory simply sat
# outside every gate the repo had.
#
# What that cost: the Prisma → Drizzle migration missed 11 scripts, which still
# call db.<table>.findMany() and throw on first use. generate-profile-slugs.ts
# imported $lib/server/slug-generator, a path that has never existed. Both
# surfaced only when the scripts were bundled for the production image.
#
# Same ratchet as check.sh: gate on the COUNT, so the existing backlog is
# tolerated and new errors fail the build.
#
# BASELINE must only ever go DOWN. The script nags when the real count drops
# below it, so the ratchet cannot quietly slip back up.
#
# Was 189 when this gate was added. Deleting the unmigrated script cluster —
# superseded by src/lib/server/resume/ and src/lib/server/profile/, and broken
# since the Drizzle cutover in 2026-04 — took out 150 of those errors.
#
# 30 -> 28 on 2026-08-09, by deleting test-html-utils.ts. It had been importing
# `../src/lib/server/html-strip.js` and `html-extract.js` since the
# src/lib/server/ domain reorg (1e2e824f) moved them to `html/strip` and
# `html/extract` — a console-printing demo, dead for months, superseded by the
# real Vitest tests in src/lib/server/__tests__/.
#
# Note the shape, because it is the limit of this gate: both imports were
# unresolvable the whole time and both errors were IN this output. They sat
# inside the tolerated backlog, so a dead script read as pre-existing noise. A
# ratchet on a count cannot tell a stale error from a live one within its
# budget. It surfaced only when build-ops-scripts.mjs was widened to bundle
# relative-path importers and the build failed outright.
#
# 26 -> 25 on 2026-09-17, free, while clearing eslint's no-unused-vars backlog:
# migrate-search-terms.ts imported `job_platform_search_presets` from the schema,
# which exports no such table. The import was unused, so removing it removed the
# error — and the same shape as the note above: a live TS2305 sitting inside the
# tolerated budget, found by a different tool looking for something else.
#
# 25 -> 23 on 2026-09-18, by adding src/app.d.ts to tsconfig.scripts.json.
# Thirteen of these errors said `Property 'user' does not exist on type
# 'Locals'` about app code that is correct: app.d.ts is ambient, nothing imports
# it, and `include` listed only scripts/, so this program was type-checking
# every transitively-reached `locals.user` against SvelteKit's empty default
# Locals. A third gate's worth of the backlog was the gate's own config. Found
# by adding one import to api-helpers.ts, which pulled auth/guards.ts in and
# produced ten "new" errors in a file nobody had touched.
#
# 23 -> 4 on 2026-09-23. 19 of the 23 sat in five scripts, and every one was a
# script that could no longer run. Three were deleted: migrate-search-terms.ts
# and migrate-encrypt-credentials.ts were one-off migrations whose tables and
# columns are gone, and test-structured-output.ts imported a module that no
# longer exists. Two were still worth having and were repaired:
# trigger-search-form-probe.ts still read credentials from platform_profiles,
# where they lived before moving to platform_credentials (its npm wrapper also
# swallowed its --credential and --device flags), and probe-groq-tools.ts cast a
# tool call's args to half the tool's schema. The 4 left are app code this
# program reaches, and svelte-check counts the same four.
BASELINE=4

npx svelte-kit sync

# tsc exits non-zero whenever errors exist, which is the thing we are deciding
# for ourselves — so don't let it abort the script.
output=$(npx tsc -p tsconfig.scripts.json --noEmit 2>&1) || true

errors=$(printf '%s\n' "$output" | grep -c 'error TS' || true)

if [ "$errors" -gt "$BASELINE" ]; then
  echo "::error::scripts/ type-check found $errors errors, baseline is $BASELINE — $((errors - BASELINE)) new."
  echo "Fix them, or if a baseline error was legitimately replaced, adjust"
  echo "BASELINE in scripts/ci/check-scripts.sh."
  printf '%s\n' "$output" | grep 'error TS' | head -40
  exit 1
fi

if [ "$errors" -lt "$BASELINE" ]; then
  echo "::notice::scripts/ type-check found $errors errors, below the baseline of $BASELINE."
  echo "Lower BASELINE in scripts/ci/check-scripts.sh to $errors to lock the improvement in."
fi

echo "scripts/ type-check: $errors errors (baseline $BASELINE) — no new type errors."
