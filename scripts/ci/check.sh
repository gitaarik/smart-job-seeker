#!/usr/bin/env bash
set -euo pipefail

# Type-check gate (svelte-check, not raw tsc — tsc alone can't see ./$types or
# $app/* and reports a different, smaller set).
#
# The tree carries a standing backlog of pre-existing errors: better-auth
# version drift, per-component Props mismatches, implicit anys, a Drizzle
# relation query. They're spread one-to-four across ~20 files, several are
# library-version issues, and none is a quick fix. Gating on zero would fail
# every PR, so gate on the COUNT instead — new errors fail the build, the
# backlog is tolerated.
#
# BASELINE must only ever go DOWN. Lower it whenever errors are fixed; the
# script nags when the actual count drops below it, so the ratchet can't
# quietly slip back up.
BASELINE=33

npx svelte-kit sync

# svelte-check exits non-zero whenever errors exist, which is exactly the
# thing we're deciding for ourselves — so don't let it abort the script.
output=$(npx svelte-check --tsconfig ./tsconfig.json --output machine 2>&1) || true

# The machine format ends with:
#   <ts> COMPLETED <n> FILES <e> ERRORS <w> WARNINGS <f> FILES_WITH_PROBLEMS
errors=$(printf '%s\n' "$output" |
  awk '/ COMPLETED /{for (i = 1; i <= NF; i++) if ($i == "ERRORS") { print $(i - 1); exit }}')

if [ -z "${errors:-}" ]; then
  echo "::error::svelte-check produced no COMPLETED summary — it likely crashed."
  printf '%s\n' "$output" | tail -30
  exit 1
fi

if [ "$errors" -gt "$BASELINE" ]; then
  echo "::error::svelte-check found $errors errors, baseline is $BASELINE — $((errors - BASELINE)) new."
  echo "New errors are somewhere in the list below; fix them or, if a baseline"
  echo "error was legitimately replaced, adjust BASELINE in scripts/ci/check.sh."
  printf '%s\n' "$output" | grep ' ERROR ' || true
  exit 1
fi

if [ "$errors" -lt "$BASELINE" ]; then
  echo "::notice::svelte-check found $errors errors, below the baseline of $BASELINE."
  echo "Lower BASELINE in scripts/ci/check.sh to $errors to lock the improvement in."
fi

echo "svelte-check: $errors errors (baseline $BASELINE) — no new type errors."
