#!/usr/bin/env bash
set -euo pipefail

# Type-check gate (svelte-check, not raw tsc — tsc alone can't see ./$types or
# $app/* and reports a different, smaller set).
#
# It started over a standing backlog of pre-existing errors: better-auth
# version drift, per-component Props mismatches, implicit anys, a Drizzle
# relation query. Gating on zero would have failed every PR, so it gated on the
# COUNT instead, a ratchet that could only go down while the backlog was worked
# off. The history below is what each step down found. It reached zero on
# 2026-09-24 and is a plain gate now, like eslint and the scripts/ type check:
# any error fails. Do not raise BASELINE to get a change through.
#
# 31 -> 29 on 2026-09-23. Both errors were one bug, and a live one: the
# import-task create action asked api_keys for a `profile` relation it lost
# when devices moved to user-wide ownership (ca521d5f, 2026-05-22). Drizzle
# does not check `with` keys against the relations, so building that query
# threw, and every create that paired a shared credential with a device was a
# 500. It sat inside this budget for four months. That is the limit
# check-scripts.sh describes: a count cannot tell a stale error from a live
# one, so an error in the backlog is still worth reading.
#
# 29 -> 25 the same day, from the four errors this gate shared with
# check-scripts.sh: a better-auth callback nothing had called since the option
# it was set on was dropped, and a legacy field the profile importer reads that
# its type had lost.
#
# 25 -> 12 on 2026-09-24. Reading each error rather than counting them found
# two more live bugs among 13: the rescrape monitor never passed the loginMode
# its credential picker needs, so the saved-logins list stayed hidden, and the
# import filter picker still named job_type, split into two axes in May, so
# both new axes lost their multi-select. The other 11 were types that no longer
# described their data: props nothing read, fields the endpoint does send, a
# nullable column, a follow-up id that ends the chain as null.
#
# 12 -> 1 the same day, all types: a `state` variable that made svelte2tsx read
# `$state` as a store (4), Locals.session typed as the wrong half of the
# session pair and an auth option the config never sets (2), and five places
# where a value's type said less than its data. The one left is not a type
# problem: import-utils.ts hands the user id an API key now resolves to on as
# a profile id, so both /api/jobs/import endpoints fail for any key. Nothing
# in these trees calls them; whether to map a key to a profile or delete them
# is a decision, not a fix.
#
# 1 -> 0 on 2026-09-24: Rik chose delete. Both endpoints went with the two
# modules only they used, and so did the '/api/jobs/import' entry in
# hooks.server.ts's PUBLIC_API_ROUTES, which matched by prefix and so had also
# been exempting /api/jobs/import/suggest from the approval check.
BASELINE=0

# state_referenced_locally is an error here, not the warning Svelte makes it.
# It flags a component reading a prop or a piece of state once, where the
# script runs, which captures the value at mount and never sees it change.
# All 351 were read on 2026-09-25 and eight were live bugs of one shape:
# SvelteKit keeps a page when only `data` or `form` changes (a notification to
# another import task, a source link to another question, a proposal applied
# behind the chat panel, a profile switch on /home, a failed `use:enhance`
# submit), and the copy went on showing, and saving, the old value. The rest
# were deliberate and now say so:
# follow `data` with a (writable) $derived, read a seed through `untrack` next
# to the reason it holds, or have an editor call remountOnAppliedChange().
# As a warning a new one would pass unseen, which is how 351 accumulated.
SVELTE_CHECK_FLAGS=(--compiler-warnings "state_referenced_locally:error")

npx svelte-kit sync

# svelte-check exits non-zero whenever errors exist, which is exactly the
# thing we're deciding for ourselves — so don't let it abort the script.
output=$(npx svelte-check --tsconfig ./tsconfig.json "${SVELTE_CHECK_FLAGS[@]}" --output machine 2>&1) || true

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
  echo "::error::svelte-check found $errors errors. The tree is clean, so these are yours."
  echo "Fix them. Do not raise BASELINE: it is 0 because the backlog is gone."
  echo

  all_errors=$(printf '%s\n' "$output" | grep ' ERROR ' || true)

  # Errors in files this change touched, first and on their own. With no
  # backlog every error is new, but one bad shared type can still put most of
  # them in files the change never opened, and which is which is the first
  # thing to know. Empty when changed-files.sh cannot tell (see its header),
  # and then the full list below is all there is.
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

# Warnings fail too, since 2026-09-26. The other 68 (form labels tied to
# nothing, click handlers without a keyboard path, `<slot>`, state updated
# without `$state`) were cleared the day after state_referenced_locally, and
# reading them turned up two more bugs: every delete confirmation ignored a
# click outside it, and Basic Info's Country label pointed at an id nothing
# carried. A warning Svelte is right about is worth fixing; one it is wrong
# about gets a svelte-ignore with the reason next to it, in its own comment
# above the ignore (svelte/no-unused-svelte-ignore reads every word of the
# ignore comment as a code).
warnings=$(printf '%s\n' "$output" |
  awk '/ COMPLETED /{for (i = 1; i <= NF; i++) if ($i == "WARNINGS") { print $(i - 1); exit }}')
if [ "${warnings:-0}" -gt 0 ]; then
  echo "::error::svelte-check found $warnings warnings. There are none on main, so these are yours."
  echo
  printf '%s\n' "$output" | grep ' WARNING ' || true
  exit 1
fi

echo "svelte-check: clean."
