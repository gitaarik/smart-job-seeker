import { describe, expect, it } from 'vitest';
import { computeDiff, type DiffSegment, diffBothWays, isSmallDiff, splitDiff } from '../word-diff';

/** Reconstruct the "new" text from the segments (same + added runs, in order). */
function reconstructNew(segments: DiffSegment[]): string {
	return segments
		.filter((s) => s.type !== 'removed')
		.map((s) => s.text)
		.join('');
}

describe('computeDiff', () => {
	it('returns a single same-segment for identical text', () => {
		const segs = computeDiff('hello world', 'hello world');
		expect(segs).toEqual([{ type: 'same', text: 'hello world' }]);
	});

	it('marks purely added words', () => {
		const segs = computeDiff('hello', 'hello there world');
		expect(segs.filter((s) => s.type === 'removed')).toHaveLength(0);
		expect(segs.some((s) => s.type === 'added' && s.text.includes('there'))).toBe(true);
		// The new text is fully reconstructable from same + added runs.
		expect(reconstructNew(segs)).toBe('hello there world');
	});

	it('marks purely removed words', () => {
		const segs = computeDiff('hello there world', 'hello world');
		expect(segs.some((s) => s.type === 'removed' && s.text.includes('there'))).toBe(true);
		expect(reconstructNew(segs)).toBe('hello world');
	});

	it('handles a replacement as removed + added', () => {
		const segs = computeDiff('the quick fox', 'the slow fox');
		expect(segs.some((s) => s.type === 'removed' && s.text.includes('quick'))).toBe(true);
		expect(segs.some((s) => s.type === 'added' && s.text.includes('slow'))).toBe(true);
		expect(reconstructNew(segs)).toBe('the slow fox');
	});

	it('preserves newlines from the new text in added/same runs', () => {
		const segs = computeDiff('line one', 'line one\n\nline two');
		expect(reconstructNew(segs)).toBe('line one\n\nline two');
	});

	it('treats going to empty as all-removed', () => {
		const segs = computeDiff('some words here', '');
		expect(segs.every((s) => s.type === 'removed')).toBe(true);
	});

	it('treats coming from empty as all-added', () => {
		const segs = computeDiff('', 'brand new text');
		expect(segs.every((s) => s.type === 'added')).toBe(true);
		expect(reconstructNew(segs)).toBe('brand new text');
	});
});

describe('isSmallDiff', () => {
	it('is true when little changed', () => {
		// One word swapped in a long sentence -> well under 30% of characters.
		const segs = computeDiff(
			'the quick brown fox jumps over the lazy dog every single morning',
			'the quick brown fox jumps over the lazy dog every single evening'
		);
		expect(isSmallDiff(segs)).toBe(true);
	});

	it('is false when most of the text changed', () => {
		const segs = computeDiff('completely different original', 'an entirely fresh rewrite here');
		expect(isSmallDiff(segs)).toBe(false);
	});

	it('is false for an empty comparison', () => {
		expect(isSmallDiff([])).toBe(false);
	});
});

describe('splitDiff', () => {
	const join = (segments: DiffSegment[]) => segments.map((s) => s.text).join('');

	it('gives back each text exactly, in its own whitespace', () => {
		// Unlike the inline diff, whose spacing is the new text's: a paragraph break
		// in the old text has to survive in the old text's pane.
		const before = 'First paragraph here.\n\nSecond paragraph,  with two spaces.\n';
		const after = 'First paragraph, reworded.\nA new second one.';
		const split = splitDiff(before, after);

		expect(join(split.before)).toBe(before);
		expect(join(split.after)).toBe(after);
	});

	it('marks only removals on the old side and only additions on the new', () => {
		const split = splitDiff('the quick brown fox', 'the slow brown fox');

		expect(split.before).toEqual([
			{ type: 'same', text: 'the ' },
			{ type: 'removed', text: 'quick' },
			{ type: 'same', text: ' brown fox' }
		]);
		expect(split.after).toEqual([
			{ type: 'same', text: 'the ' },
			{ type: 'added', text: 'slow' },
			{ type: 'same', text: ' brown fox' }
		]);
	});

	it('keeps the gap between runs out of the marked one', () => {
		// So a highlight starts and ends on a word, not on a coloured space.
		const split = splitDiff('keep drop keep', 'keep keep');
		const removed = split.before.find((s) => s.type === 'removed');

		expect(removed?.text).toBe('drop');
	});

	it('is one alignment for both views', () => {
		// diffBothWays exists so a rewrite is aligned once, not twice.
		const both = diffBothWays('a b c d', 'a x c y');

		expect(both.inline).toEqual(computeDiff('a b c d', 'a x c y'));
		expect({ before: both.before, after: both.after }).toEqual(splitDiff('a b c d', 'a x c y'));
	});

	it('handles an empty side', () => {
		expect(splitDiff('', 'new words')).toEqual({
			before: [],
			after: [{ type: 'added', text: 'new words' }]
		});
		expect(splitDiff('old words', '')).toEqual({
			before: [{ type: 'removed', text: 'old words' }],
			after: []
		});
	});
});
