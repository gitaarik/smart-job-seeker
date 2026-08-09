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
BASELINE=28

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
