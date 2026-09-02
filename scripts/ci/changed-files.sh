#!/usr/bin/env bash
# Repo-relative paths this change touches, one per line. Empty if it cannot tell.
#
# The ratchet gates report a COUNT — "1461 errors, baseline 1457, 4 new" — and
# then print the first 40 of a 1,457-error backlog, none of which are yours.
# Finding the 4 meant re-running eslint per file by hand. This is what lets the
# gates say WHERE instead, by filtering their output down to files the change
# actually touched.
#
# FAILS OPEN, deliberately and in every direction: no git, a shallow clone, a
# detached HEAD — all print nothing, and a caller that gets nothing must fall
# back to its old behaviour rather than claiming the change touched no files.
#
# SJS_CHANGED_FILES overrides everything, for callers that know the answer and
# know this cannot work them out. check-oss.sh is the one that does: it mounts
# ./oss into a container where .git is a file pointing at a host path, so git
# here answers nothing at all.
#
# Three sources, most specific first:
#   1. GITHUB_BASE_REF  — a PR: everything since it left the base branch.
#   2. an upstream      — a local branch: commits ahead, plus uncommitted work.
#   3. neither          — uncommitted work only.
set -uo pipefail

# Supplied by the caller when git cannot answer from where this runs.
# check-oss.sh works the list out on the host and passes it in, because inside
# its container ./oss is a submodule whose `.git` file points at a host path —
# so every branch below would come up empty and the gate would print the whole
# backlog, which is what that script exists to avoid.
if [ -n "${SJS_CHANGED_FILES:-}" ]; then
	printf '%s\n' "$SJS_CHANGED_FILES"
	exit 0
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

emit() { git diff --name-only "$@" 2>/dev/null || true; }

{
	if [ -n "${GITHUB_BASE_REF:-}" ]; then
		# Actions checks out a shallow clone, so the merge base usually isn't
		# present until it is fetched. If the fetch fails the three-dot diff
		# fails too, and this prints nothing — see FAILS OPEN above.
		git fetch --quiet --depth=50 origin "$GITHUB_BASE_REF" 2>/dev/null || true
		emit "origin/${GITHUB_BASE_REF}...HEAD"
	elif git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
		emit '@{upstream}...HEAD'
		emit HEAD
	else
		emit HEAD
	fi
	# Untracked files are part of the change and no diff lists them. A new
	# component with a new error in it is precisely the case worth catching.
	git ls-files --others --exclude-standard 2>/dev/null || true
} | sed 's#^\./##' | sort -u
