#!/usr/bin/env bash
set -euo pipefail

# eslint gate — the third ratchet, alongside check.sh (svelte-check) and
# check-scripts.sh (scripts/ type-check).
#
# eslint has never run in CI, and the backlog reflects that. It is overwhelmingly
# style rather than defect:
#
#     758  @typescript-eslint/no-explicit-any
#     239  svelte/no-navigation-without-resolve
#     236  svelte/require-each-key
#     164  @typescript-eslint/no-unused-vars
#      10  svelte/no-at-html-tags
#
# Almost none of it is auto-fixable — 5 of 1,509 carried a fix — so `--fix` is
# not a way out of it. Gating on zero would fail every PR; gating on the COUNT
# stops it growing while the backlog is worked down deliberately.
#
# Two rules here are worth more attention than their count suggests:
#
#   svelte/no-at-html-tags — every one of the 10 remaining sites was audited on
#     2026-08-07. Four render LLM output through renderSafeMarkdown, three escape
#     scraped HTML before highlighting it, one is linkify (escapes first), one is
#     repo-authored guide markdown, and one is FiveYearVisionSection, which now
#     escapes before applying its bold rule. A NEW hit on this rule is not
#     backlog — it is an unreviewed HTML sink, and public portfolio pages render
#     user-authored content. Read it before raising the baseline.
#
#   svelte/require-each-key — unkeyed {#each} blocks mismatch component state
#     when a list reorders, and this app has drag-reordering throughout
#     (svelte-dnd-action). Some of these 236 are latent bugs, not lint noise.
#
# DO NOT set this from a count taken in the dev app container. It will be wrong.
# docker-compose.yml bind-mounts cloud's billing overlay over OSS's stubs:
#
#   ./src/lib/server/billing -> /app/src/lib/server/billing
#   ./src/routes/api/billing -> /app/src/routes/api/billing
#   ./src/routes/(app)/billing -> /app/src/routes/(app)/billing
#
# so eslint in the container lints the overlay (8 errors) while CI lints the
# stubs (21). Everything else agrees exactly — 1,500 either way — and the whole
# 13-error gap is those paths. This baseline is CI's number, which is the one
# that counts. The same mount had already produced a false-clean prettier run.
#
# BASELINE must only ever go DOWN. The script nags when the real count drops
# below it, so the ratchet cannot quietly slip back up.
#
# 1506 -> 1486 on 2026-08-16, by fixing every rule whose violations were small
# in number and unambiguous to repair: prefer-const (5, via --fix), stale
# svelte-ignore comments whose warning no longer fires (4), preserve-caught-error
# (6, now passing `{ cause }` — the one change here that improves a stack trace
# rather than a count), no-control-regex (2, justified disables: matching the
# control character IS the point in both), and empty catch blocks (2, given the
# comment that says why they are empty).
#
# Two rules were deliberately left in the budget. svelte/no-useless-mustaches
# flags `{' '}` and a multi-line string literal, and both mustaches are load
# bearing — one forces a space the whitespace collapser would eat, the other
# carries newlines that an HTML attribute would have to encode as entities.
# Changing behaviour to satisfy a cosmetic rule is the wrong trade.
BASELINE=1486

npx svelte-kit sync

# eslint exits non-zero whenever errors exist, which is the thing we are
# deciding for ourselves — so don't let it abort the script.
output=$(npx eslint . -f json 2>/dev/null) || true

errors=$(printf '%s' "$output" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try {
    const r = JSON.parse(s);
    let n = 0;
    for (const f of r) for (const m of f.messages) if (m.severity === 2) n++;
    console.log(n);
  } catch { console.log(''); }
});")

if [ -z "${errors:-}" ]; then
  echo "::error::eslint produced no parsable JSON — it likely crashed."
  printf '%s\n' "$output" | tail -20
  exit 1
fi

if [ "$errors" -gt "$BASELINE" ]; then
  echo "::error::eslint found $errors errors, baseline is $BASELINE — $((errors - BASELINE)) new."
  echo "Fix them, or if a baseline error was legitimately replaced, adjust"
  echo "BASELINE in scripts/ci/check-lint.sh."
  npx eslint . -f stylish 2>/dev/null | grep -E '  error  ' | head -40 || true
  exit 1
fi

if [ "$errors" -lt "$BASELINE" ]; then
  echo "::notice::eslint found $errors errors, below the baseline of $BASELINE."
  echo "Lower BASELINE in scripts/ci/check-lint.sh to $errors to lock the improvement in."
fi

echo "eslint: $errors errors (baseline $BASELINE) — no new lint errors."
