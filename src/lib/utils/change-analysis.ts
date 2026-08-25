/**
 * Reading a field change: which ones need a diff, and what the diff found.
 *
 * The engine is `word-diff.ts`; this is the layer that decides what to do with
 * it, and it exists because three surfaces were answering that question and
 * only one of them was answering it well. The chat's proposal card had all of
 * this inline; `/data/ai-changes` — the surface where a Tier 2 change is
 * actually approved — hand-rolled `old → new` in two places and showed a
 * 5,000-character description twice over to say four words had moved.
 *
 * The server has its own rendering of the same decision for readers that cannot
 * display markup (`ai-chat/proposal-summary.ts`). That one is deliberately a
 * sibling rather than a caller: the shapes it emits are lines of text, not
 * segments, and collapsing them would make one of the two worse.
 */

import { computeDiff, isSmallDiff, type DiffSegment } from './word-diff';

/**
 * Above this, a value is summarised rather than shown — and is a candidate for
 * a diff, because it is no longer readable at a glance either way.
 *
 * Kept equal to `proposal-summary.ts`'s constant of the same name on purpose:
 * the two renderings disagreeing about which fields are "long" would show a
 * different set of changes in the browser than in a tool result.
 */
export const LONG_VALUE_CHARS = 120;

/**
 * How short a removed run has to be before it counts as rewording rather than
 * a cut.
 *
 * Chosen, not guessed, but on a thin corpus: every stored rewrite proposal
 * yields 7.5 runs per card at 40 characters, 4.0 at 80 and 2.5 at 120, and the
 * paragraph this was built to catch survives all three. Length is a weak
 * discriminator — a rewritten region comes back as a removed run too, and some
 * of those run past 100 characters — so the panel is labelled as what it
 * literally is rather than as "what you lost". 80 halves the churn without
 * reaching the length of a dropped sentence.
 */
export const DROPPED_RUN_CHARS = 80;

/** How much of a short value may change before old → new reads better than a diff. */
export const SHORT_DIFF_MAX_CHANGED = 0.5;

export interface FieldChange {
	field: string;
	label: string;
	from: string;
	to: string;
}

export interface AnalysedChange {
	change: FieldChange;
	/**
	 * The inline word diff, or null when the texts share too little for one to
	 * be readable — in which case the caller shows the new text instead.
	 */
	segments: DiffSegment[] | null;
	/** Runs of the old text with no counterpart in the new one. */
	dropped: string[];
}

/** "—" is how an unset value is rendered; as diff input it means empty. */
export const asText = (value: string) => (value === '—' ? '' : value);

/**
 * Rows whose real content a summary would hide. Short ones are shown whole —
 * as a diff where the edit is small, see `inlineDiff`.
 */
export function isLong(change: { from: string; to: string }): boolean {
	return change.from.length > LONG_VALUE_CHARS || change.to.length > LONG_VALUE_CHARS;
}

/**
 * The inline diff for a short change, or null when old → new reads better.
 *
 * Short values are where a diff is both cheapest and most needed: two lines of
 * text, and the edit is usually one word — "regression" → "regressions", a
 * dropped "+", one letter of a product name. Old-struck-through → new leaves
 * the reader to find that word by eye; the diff points at it.
 *
 * Null for a long value (those get the on-demand panel, see `analyseChanges`),
 * for a value being set or cleared (nothing to compare), and for a rewrite —
 * once less than half of it is unchanged, old → new reads better than a
 * stripe of every word removed and every word added. That is a looser line
 * than the panel's 30%, on purpose: in a one-line value a single changed word
 * is already 40% of the characters, and the queue this was calibrated on
 * split cleanly — grammar fixes at 2–16%, rewordings at 33–49% that still
 * read well marked in place, rewrites at 60% and up.
 *
 * Cheap enough to call eagerly, unlike `analyseChanges`: the LCS matrix for
 * two 120-character values is a few hundred cells.
 */
export function inlineDiff(change: { from: string; to: string }): DiffSegment[] | null {
	if (isLong(change)) return null;
	const from = asText(change.from);
	const to = asText(change.to);
	if (!from || !to) return null;
	const segments = computeDiff(from, to);
	return isSmallDiff(segments, SHORT_DIFF_MAX_CHANGED) ? segments : null;
}

/** A value as it reads in a one-line list: itself, or its shape. */
export function summarizeValue(value: string): string {
	if (value === '—' || value === '') return 'empty';
	if (value.length <= LONG_VALUE_CHARS) return value;
	return `${value.length.toLocaleString()} characters`;
}

/**
 * How much shorter the replacement is, when it is materially shorter.
 *
 * Said out loud rather than left to be worked out from two character counts
 * either side of an arrow. A replacement shorter than what it replaces is the
 * one shape of edit whose loss is invisible: the new text reads perfectly well,
 * and nothing about it says what used to be there.
 */
export function shrinkage(change: { from: string; to: string }): number {
	if (!isLong(change) || change.from === '—') return 0;
	return Math.max(0, change.from.length - change.to.length);
}

/**
 * Each long change, diffed once, with what a rewrite dropped pulled out.
 *
 * A tweak gets the word diff inline — the same threshold the version editors
 * use, because diffing two texts that share almost nothing produces an
 * unreadable stripe of every word deleted and every word added, which hides the
 * very thing the user opened this to read.
 *
 * A wholesale rewrite got only the new text, and that is the hole `dropped`
 * fills. Asked to combine a job posting with a second one pasted into the chat,
 * the assistant returned a merge 950 characters SHORTER than the description it
 * replaced — and because a merge changes far more than 30% of the words, the
 * card showed the new text with nothing to say a whole paragraph of the old one
 * had gone. No prompt makes an LLM rewrite lossless; what it can do is not be
 * silent about it.
 *
 * **Call this lazily.** The LCS builds a full (m+1)x(n+1) matrix of words, so a
 * pair of 5,000-word texts is 25 million cells on the main thread. The chat
 * runs it per expanded card; the approvals page can have dozens of requests on
 * screen at once, and running it for all of them to render nothing is the
 * difference between a page and a stall.
 */
export function analyseChanges(changes: FieldChange[]): AnalysedChange[] {
	return changes.map((change) => {
		const segments = computeDiff(asText(change.from), asText(change.to));
		return {
			change,
			segments: isSmallDiff(segments) ? segments : null,
			dropped: segments
				.filter((s) => s.type === 'removed' && s.text.trim().length >= DROPPED_RUN_CHARS)
				.map((s) => s.text.trim())
		};
	});
}
