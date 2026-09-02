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
BASELINE=31

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
  echo "Fix them, or if a baseline error was legitimately replaced, adjust"
  echo "BASELINE in scripts/ci/check.sh."
  echo

  all_errors=$(printf '%s\n' "$output" | grep ' ERROR ' || true)

  # Errors in files this change touched, first and on their own. The whole list
  # is the backlog plus yours, and the backlog is 31 lines of libraries and
  # other people's components — reading it to find your own is the work this
  # saves. Empty when changed-files.sh cannot tell (see its header), and then
  # the full list below is all there is.
  changed=$(./scripts/ci/changed-files.sh 2>/dev/null || true)
  if [ -n "$changed" ]; then
    mine=$(printf '%s\n' "$all_errors" | grep -F -f <(printf '%s\n' "$changed" | sed 's/.*/"&"/') || true)
    if [ -n "$mine" ]; then
      echo "── In files this change touched ──"
      printf '%s\n' "$mine"
      echo
    else
      # Worth saying rather than leaving blank: it means the change broke a file
      # it never edited, which is what a bad type inference does — one bad
      # property in a shared include can move errors into consumers only.
      echo "── None of the errors are in files this change touched. ──"
      echo "   A change can still cause them elsewhere: a shared type that stops"
      echo "   inferring moves its errors into every consumer. Look for a file"
      echo "   you edited that others import."
      echo
    fi
  fi

  echo "── All $errors errors ──"
  printf '%s\n' "$all_errors"
  exit 1
fi

if [ "$errors" -lt "$BASELINE" ]; then
  echo "::notice::svelte-check found $errors errors, below the baseline of $BASELINE."
  echo "Lower BASELINE in scripts/ci/check.sh to $errors to lock the improvement in."
fi

echo "svelte-check: $errors errors (baseline $BASELINE) — no new type errors."
