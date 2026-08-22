import { describe, expect, it } from 'vitest';
import {
	analyseChanges,
	DROPPED_RUN_CHARS,
	isLong,
	LONG_VALUE_CHARS,
	shrinkage,
	summarizeValue
} from '../change-analysis';

const long = (word: string, times: number) => Array(times).fill(word).join(' ');

const change = (from: string, to: string) => ({ field: 'summary', label: 'Summary', from, to });

describe('isLong', () => {
	it('is what decides whether a field gets a diff at all', () => {
		expect(isLong(change('short', 'also short'))).toBe(false);
		expect(isLong(change('x'.repeat(LONG_VALUE_CHARS + 1), 'short'))).toBe(true);
		// Either side being long is enough — a short value replaced by an essay is
		// exactly the case a reader needs the full text for.
		expect(isLong(change('short', 'x'.repeat(LONG_VALUE_CHARS + 1)))).toBe(true);
	});
});

describe('summarizeValue', () => {
	it('shows a short value and the shape of a long one', () => {
		expect(summarizeValue('Reactive state management')).toBe('Reactive state management');
		expect(summarizeValue('x'.repeat(5204))).toBe('5,204 characters');
	});

	it('says "empty" for both spellings of unset', () => {
		expect(summarizeValue('—')).toBe('empty');
		expect(summarizeValue('')).toBe('empty');
	});
});

describe('shrinkage', () => {
	it('reports how much shorter a long replacement is', () => {
		const from = 'x'.repeat(5204);
		expect(shrinkage(change(from, 'x'.repeat(4830)))).toBe(374);
	});

	it('is silent when nothing was lost', () => {
		// Growing is not a loss, a short field is already fully visible, and
		// filling something empty replaces nothing.
		expect(shrinkage(change('x'.repeat(200), 'x'.repeat(400)))).toBe(0);
		expect(shrinkage(change('short', 'shorter'))).toBe(0);
		expect(shrinkage(change('—', 'x'.repeat(400)))).toBe(0);
	});
});

describe('analyseChanges', () => {
	it('gives a small edit an inline diff', () => {
		const from = `${long('alpha', 40)} beta`;
		const [result] = analyseChanges([change(from, `${long('alpha', 40)} gamma`)]);

		expect(result.segments).not.toBeNull();
		expect(result.segments?.some((s) => s.type === 'removed' && s.text.includes('beta'))).toBe(
			true
		);
		expect(result.segments?.some((s) => s.type === 'added' && s.text.includes('gamma'))).toBe(true);
	});

	it('refuses to diff a wholesale rewrite', () => {
		// Two texts sharing almost nothing produce a stripe of every word deleted
		// and every word added, which hides the thing the reader opened this for.
		// The caller shows the new text instead.
		const [result] = analyseChanges([change(long('alpha', 60), long('omega', 60))]);

		expect(result.segments).toBeNull();
	});

	it('surfaces what a rewrite dropped, which is the case a diff cannot show', () => {
		// The measured failure: a merge came back materially shorter, and because
		// it changed far more than 30% of the words there was no inline diff to
		// notice the missing paragraph in.
		const paragraph = long('paragraph', 20);
		const [result] = analyseChanges([
			change(`${long('alpha', 60)} ${paragraph}`, long('omega', 60))
		]);

		expect(result.segments).toBeNull();
		expect(result.dropped.some((run) => run.includes(paragraph))).toBe(true);
	});

	it('ignores removals too short to be a cut rather than a rewording', () => {
		const [result] = analyseChanges([change(long('alpha', 60), `${long('omega', 60)} tiny`)]);

		expect(result.dropped.every((run) => run.length >= DROPPED_RUN_CHARS)).toBe(true);
	});

	it('reads "—" as empty rather than as a character', () => {
		const [result] = analyseChanges([change('—', long('omega', 40))]);

		expect(result.segments?.every((s) => s.type === 'added') ?? true).toBe(true);
		expect(result.dropped).toEqual([]);
	});
});
