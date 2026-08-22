/**
 * A proposed edit, in prose.
 *
 * `describeProposalChanges` produces from/to pairs and ProposalCard renders
 * them: colour, an arrow, an expander, inline word-level highlighting. That is
 * the right shape for a chat panel and no shape at all for anything else — an
 * MCP tool result, an audit line, a notification, an agent relaying what it is
 * about to do. Those need sentences.
 *
 * Same split as the context sources (see generation-context.ts): the data is
 * one thing, and a rendering addressed to a particular reader is another. This
 * is a second rendering of the same `ProposedChange[]`, not a second source of
 * truth — which is why it takes the pairs rather than reaching for the row.
 *
 * The hard case is a long text. "Description: 5,204 characters → 4,830
 * characters" is honest and tells you nothing about whether you want it, and
 * pasting both versions is unreadable in every consumer listed above. So a long
 * field gets a shape line plus excerpts of what actually differs, taken from
 * the same LCS word-diff the card highlights with.
 */

import { computeDiff, type DiffSegment } from '$lib/utils/word-diff';
import type { ProposedChange } from './capabilities';

/** Above this, a value is summarised and excerpted rather than quoted. */
const LONG_VALUE_CHARS = 120;

/** How many changed runs to quote per field, longest first. */
const MAX_EXCERPTS = 4;

/**
 * Runs shorter than this are noise — a changed comma, a moved "the".
 *
 * A preference, not a floor. It earns its keep when there are longer runs to
 * show instead; when every changed run is under it, the short ones ARE the
 * change, and dropping them leaves a shape line that says a 5,204-character
 * description was rewritten and refuses to say what moved. That is the small
 * edit in a long text — the case a reader most needs help with, and the one
 * where a strict threshold helps least.
 */
const MIN_EXCERPT_CHARS = 12;

/** Cap on a single quoted run, so one rewritten paragraph can't be the summary. */
const MAX_EXCERPT_CHARS = 140;

/** The sentinel describeProposalChanges uses for an absent value. */
const EMPTY = '—';

function clip(text: string, max: number): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * The changed runs of a long-text edit: the most substantial ones, in the order
 * they appear.
 *
 * Chosen by length, because a rewrite's opening is often its least interesting
 * part — reflowed whitespace, a reworded greeting — and the run carrying the
 * actual change is somewhere in the middle, so taking the first few would spend
 * the budget before reaching it.
 *
 * Then re-sorted into document order, because the selection order is not a
 * reading order. Longest-first interleaves additions and removals from
 * different parts of the text, and the result reads as a shuffled bag of
 * fragments rather than as a description of an edit.
 */
function excerpts(segments: DiffSegment[]): string[] {
	const changed = segments
		.map((segment, index) => ({ segment, index }))
		.filter(({ segment }) => segment.type !== 'same' && segment.text.trim().length > 0);

	// Prefer runs substantial enough to stand alone; fall back to whatever
	// changed when none of them are. See MIN_EXCERPT_CHARS.
	const substantial = changed.filter(
		({ segment }) => segment.text.trim().length >= MIN_EXCERPT_CHARS
	);

	return (substantial.length > 0 ? substantial : changed)
		.sort((a, z) => z.segment.text.length - a.segment.text.length)
		.slice(0, MAX_EXCERPTS)
		.sort((a, z) => a.index - z.index)
		.map(
			({ segment }) =>
				`${segment.type === 'added' ? '+' : '−'} ${clip(segment.text, MAX_EXCERPT_CHARS)}`
		);
}

/**
 * One field's change as a line, plus excerpt lines for a long text.
 *
 * Exported because the MCP queue listing needs exactly this and had grown its
 * own worse version: a flat 200-character truncation of both sides, which for a
 * one-word fix in a long description prints the same 200 characters twice and
 * calls it a diff. A reader that cannot render markup still deserves to be told
 * what moved.
 */
export function describeChangeLines(change: ProposedChange): string[] {
	const { label, from, to } = change;
	const wasEmpty = from === EMPTY;
	const isEmpty = to === EMPTY;

	if (isEmpty) return [`${label}: cleared (was ${clip(from, 60)})`];
	if (wasEmpty) {
		return from.length + to.length > LONG_VALUE_CHARS && to.length > LONG_VALUE_CHARS
			? [`${label}: set, ${to.length.toLocaleString()} characters`]
			: [`${label}: set to ${clip(to, LONG_VALUE_CHARS)}`];
	}

	// Both short enough to read: the whole point of a diff, said plainly.
	if (from.length <= LONG_VALUE_CHARS && to.length <= LONG_VALUE_CHARS) {
		return [`${label}: ${from} → ${to}`];
	}

	const lines = [
		`${label}: rewritten, ${from.length.toLocaleString()} → ` +
			`${to.length.toLocaleString()} characters`
	];
	const quoted = excerpts(computeDiff(from, to));
	// No run long enough to quote means the change is scattered or trivial;
	// claiming "no changes" would be wrong, so the shape line stands alone.
	for (const line of quoted) lines.push(`    ${line}`);
	return lines;
}

/**
 * Render a proposal as plain text.
 *
 * `title` is the capability's own ("Edit the job's details"), `target` names the
 * row. Returns "" when there is nothing to say, so a caller can drop the whole
 * block rather than print a heading over an empty list — the same reason the
 * context sources return "" rather than an empty section.
 */
export function summarizeProposal(opts: {
	title: string;
	target: { label: string };
	changes: ProposedChange[];
	rationale?: string;
	applied?: boolean;
}): string {
	if (opts.changes.length === 0) return '';

	const verb = opts.applied ? 'Applied' : 'Proposed';
	const lines = [`${verb}: ${opts.title} — ${opts.target.label}`];
	if (opts.rationale?.trim()) lines.push(opts.rationale.trim());
	lines.push('');
	for (const change of opts.changes) {
		for (const line of describeChangeLines(change)) lines.push(`  ${line}`);
	}
	return lines.join('\n');
}
