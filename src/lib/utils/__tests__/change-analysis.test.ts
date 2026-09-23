import { describe, expect, it } from 'vitest';
import {
	analyseChanges,
	isLong,
	LONG_VALUE_CHARS,
	shrinkage,
	summarizeValue,
	inlineDiff
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

	it('shows a wholesale rewrite as the two texts, not one marked twice', () => {
		// Two texts sharing almost nothing produce a stripe of every word deleted
		// and every word added. Split, each is whole and reads as itself.
		const from = long('alpha', 60);
		const to = long('omega', 60);
		const [result] = analyseChanges([change(from, to)]);

		expect(result.segments).toBeNull();
		expect(result.split?.before.map((s) => s.text).join('')).toBe(from);
		expect(result.split?.after.map((s) => s.text).join('')).toBe(to);
	});

	it('marks what a rewrite dropped in the old text, where it was', () => {
		// The measured failure: a merge came back materially shorter, and because
		// it changed far more than 30% of the words there was no inline diff to
		// notice the missing paragraph in. Before this, only the new text showed.
		const paragraph = long('paragraph', 20);
		const [result] = analyseChanges([
			change(`${long('alpha', 60)} ${paragraph}`, long('omega', 60))
		]);

		expect(
			result.split?.before.some((s) => s.type === 'removed' && s.text.includes(paragraph))
		).toBe(true);
	});

	it('has no before to show for a value set where there was none', () => {
		const [result] = analyseChanges([change('—', long('omega', 40))]);

		expect(result.segments).toBeNull();
		expect(result.split).toBeNull();
	});

	it('shows a cleared value as the text that went, and nothing after', () => {
		const from = long('alpha', 40);
		const [result] = analyseChanges([change(from, '—')]);

		expect(result.split?.before).toEqual([{ type: 'removed', text: from }]);
		expect(result.split?.after).toEqual([]);
	});
});

describe('inlineDiff', () => {
	it('marks the word that changed in a short value', () => {
		const segments = inlineDiff({
			from: 'Reduced regression by 90% by setting up TDD.',
			to: 'Reduced regressions by 90% by setting up TDD.'
		});
		expect(segments).not.toBeNull();
		const of = (type: string) => segments!.filter((s) => s.type === type).map((s) => s.text.trim());
		expect(of('removed')).toEqual(['regression']);
		expect(of('added')).toEqual(['regressions']);
	});

	it('still diffs a rewording that keeps at least half of the line', () => {
		// 47% of the characters change here; the panel's 30% rule would refuse it,
		// and on one line it reads better marked in place than as old → new.
		expect(
			inlineDiff({
				from: 'Scaled the platform to handle loads of thousands of orders per minute by optimizing SQL & Python processes up to 60%.',
				to: 'Scaled the platform to handle thousands of orders per minute by optimizing SQL & Python, making checkout 60% faster.'
			})
		).not.toBeNull();
	});

	it('leaves a rewrite to old → new', () => {
		expect(
			inlineDiff({
				from: 'Supported marketing by sending thousands of emails in a system made with Python, Django, Celery & SendGrid.',
				to: 'Built the marketing email system (Python, Django, Celery & SendGrid) that delivered thousands of campaign emails.'
			})
		).toBeNull();
	});

	it('leaves a long value to the on-demand panel', () => {
		const long = 'word '.repeat(30).trim();
		expect(long.length).toBeGreaterThan(120);
		expect(inlineDiff({ from: long, to: `${long} more` })).toBeNull();
	});

	it('has nothing to compare when a value is set or cleared', () => {
		expect(inlineDiff({ from: '—', to: 'Haarlem, NL' })).toBeNull();
		expect(inlineDiff({ from: 'Haarlem, NL', to: '' })).toBeNull();
	});
});
