/**
 * Word-level text diff via LCS.
 *
 * Extracted from the application-letter editor so the letter and application-
 * question editors can share one diff engine. Produces a flat list of
 * segments (same / added / removed) suitable for inline highlighting. Whitespace
 * is taken from the new text so the rendered "added"/"same" run reads naturally;
 * removed runs get a single separating space.
 *
 * `splitDiff` is the same alignment as two texts instead of one, for a change
 * too large to read marked in place.
 */

export type DiffSegment = { type: 'same' | 'added' | 'removed'; text: string };

/** One word of the alignment: in both texts, or in only one of them. */
type AlignedWord = { type: DiffSegment['type']; text: string };

function wordsOf(text: string): string[] {
	return text.split(/\s+/).filter(Boolean);
}

/**
 * The two texts' words lined up by their longest common subsequence, in reading
 * order: each word shared by both, added by the new text, or removed from the
 * old. Whitespace plays no part, so a reflowed paragraph is not a change.
 */
function align(oldWords: string[], newWords: string[]): AlignedWord[] {
	const m = oldWords.length,
		n = newWords.length;

	// LCS via DP
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] =
				oldWords[i - 1] === newWords[j - 1]
					? dp[i - 1][j - 1] + 1
					: Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}

	// Backtrack to build word-level diff
	const raw: AlignedWord[] = [];
	let i = m,
		j = n;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
			raw.push({ type: 'same', text: oldWords[i - 1] });
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			raw.push({ type: 'added', text: newWords[j - 1] });
			j--;
		} else {
			raw.push({ type: 'removed', text: oldWords[i - 1] });
			i--;
		}
	}
	return raw.reverse();
}

export function computeDiff(oldText: string, newText: string): DiffSegment[] {
	return inlineSegments(align(wordsOf(oldText), wordsOf(newText)), newText);
}

/** The alignment as one marked text, in the new text's whitespace. */
function inlineSegments(raw: AlignedWord[], newText: string): DiffSegment[] {
	// Build whitespace map from new text: whitespace before each word
	const newParts = newText.split(/(\s+)/);
	const newSpaces: string[] = [];
	let ws = '';
	for (const part of newParts) {
		if (/^\s*$/.test(part)) ws += part;
		else {
			newSpaces.push(ws);
			ws = '';
		}
	}

	// Merge consecutive same-type words with new text's whitespace
	const segments: DiffSegment[] = [];
	let nIdx = 0; // position in new text words
	for (const seg of raw) {
		// Use new text's whitespace for added/same words; simple space for removed
		let space: string;
		if (seg.type === 'removed') {
			space = segments.length > 0 ? ' ' : '';
		} else {
			space = nIdx > 0 ? newSpaces[nIdx] || ' ' : newSpaces[0] || '';
			nIdx++;
		}

		if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
			segments[segments.length - 1].text += space + seg.text;
		} else {
			segments.push({
				type: seg.type,
				text: (segments.length > 0 ? space : '') + seg.text
			});
		}
	}
	return segments;
}

/** Both texts whole, each marked with its own half of a diff. */
export interface SplitDiff {
	/** The old text: what the new one kept, and what it removed. */
	before: DiffSegment[];
	/** The new text: what it kept, and what it added. */
	after: DiffSegment[];
}

/**
 * The diff as two texts rather than one: the old one with its removals marked,
 * the new one with its additions.
 *
 * For a rewrite. Marked in one text, every word removed and every word added
 * interleave into a stripe nobody can read; side by side, each still reads as
 * the text it is. Unlike `computeDiff`, each side keeps its OWN whitespace, so
 * the old text's paragraphs survive and the runs of either side joined back
 * together are exactly that text.
 */
export function splitDiff(oldText: string, newText: string): SplitDiff {
	return splitSegments(align(wordsOf(oldText), wordsOf(newText)), oldText, newText);
}

/**
 * The inline diff and the split one from a single alignment, for a caller that
 * decides which to show from the inline one. The alignment is the quadratic
 * part, so computing it twice for a long text is the cost worth avoiding.
 */
export function diffBothWays(
	oldText: string,
	newText: string
): { inline: DiffSegment[] } & SplitDiff {
	const raw = align(wordsOf(oldText), wordsOf(newText));
	return { inline: inlineSegments(raw, newText), ...splitSegments(raw, oldText, newText) };
}

function splitSegments(raw: AlignedWord[], oldText: string, newText: string): SplitDiff {
	return {
		before: marked(
			oldText,
			raw.filter((word) => word.type !== 'added').map((word) => word.type)
		),
		after: marked(
			newText,
			raw.filter((word) => word.type !== 'removed').map((word) => word.type)
		)
	};
}

/**
 * One text cut into runs by the marks on its words, its whitespace kept exactly.
 *
 * The space between two runs goes with the unmarked one, so a marked run starts
 * and ends on a word rather than on a highlighted gap.
 */
function marked(text: string, marks: DiffSegment['type'][]): DiffSegment[] {
	const segments: DiffSegment[] = [];
	let space = '';
	let index = 0;

	for (const part of text.split(/(\s+)/)) {
		if (part === '') continue;
		if (/^\s+$/.test(part)) {
			space += part;
			continue;
		}

		const type = marks[index++] ?? 'same';
		const last = segments[segments.length - 1];
		if (!last) segments.push({ type, text: space + part });
		else if (last.type === type) last.text += space + part;
		else if (last.type === 'same') {
			last.text += space;
			segments.push({ type, text: part });
		} else segments.push({ type, text: space + part });
		space = '';
	}

	if (space) {
		const last = segments[segments.length - 1];
		if (last) last.text += space;
		else segments.push({ type: 'same', text: space });
	}
	return segments;
}

/**
 * True when less than `maxChanged` of the characters changed — used to decide
 * whether a diff is readable at all. The default suits a long text, where a
 * rewrite turns into a stripe of every word removed and every word added; a
 * caller showing a one-line value can afford more, see `inlineDiff`.
 */
export function isSmallDiff(segments: DiffSegment[], maxChanged = 0.3): boolean {
	let changedChars = 0;
	let totalChars = 0;
	for (const seg of segments) {
		totalChars += seg.text.length;
		if (seg.type !== 'same') changedChars += seg.text.length;
	}
	return totalChars > 0 && changedChars / totalChars < maxChanged;
}
