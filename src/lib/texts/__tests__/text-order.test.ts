import { describe, expect, it } from 'vitest';
import { compareTexts, parseTextKey, placeInOrder, textKey, type OrderedText } from '../text-order';

const day = (d: number) => new Date(Date.UTC(2026, 8, d));

function text(
	itemType: OrderedText['itemType'],
	id: number,
	date_created: Date | string | null,
	sort: number | null = null
): OrderedText {
	return { itemType, id, sort, date_created };
}

const ordered = (texts: OrderedText[]) => [...texts].sort(compareTexts).map(textKey);

describe('compareTexts', () => {
	it('puts the newest added first, whatever was edited since', () => {
		// Nothing here carries date_updated: the last edit has no say.
		expect(
			ordered([
				text('question', 1, day(17)),
				text('letter', 9, day(24)),
				text('question', 3, day(27))
			])
		).toEqual(['question:3', 'letter:9', 'question:1']);
	});

	it('keeps texts added together in the order they came in', () => {
		expect(
			ordered([
				text('question', 12, day(17)),
				text('question', 10, day(17)),
				text('question', 11, day(17))
			])
		).toEqual(['question:10', 'question:11', 'question:12']);
	});

	it('reads dates that arrive as strings', () => {
		expect(
			ordered([text('question', 1, '2026-09-17T10:00:00Z'), text('question', 2, day(27))])
		).toEqual(['question:2', 'question:1']);
	});

	it('puts a text with no date last', () => {
		expect(ordered([text('letter', 1, null), text('question', 2, day(1))])).toEqual([
			'question:2',
			'letter:1'
		]);
	});

	it('follows the manual order once there is one, across both kinds', () => {
		expect(
			ordered([
				text('question', 1, day(17), 0),
				text('letter', 9, day(24), 2),
				text('question', 3, day(27), 1)
			])
		).toEqual(['question:1', 'question:3', 'letter:9']);
	});

	it('puts a text added after the manual order on top, newest first', () => {
		expect(
			ordered([
				text('question', 1, day(17), 0),
				text('question', 4, day(28)),
				text('letter', 9, day(24), 1),
				text('question', 5, day(29))
			])
		).toEqual(['question:5', 'question:4', 'question:1', 'letter:9']);
	});

	it('has a last word for a letter and a question added at the same moment', () => {
		expect(ordered([text('question', 1, day(17)), text('letter', 1, day(17))])).toEqual([
			'letter:1',
			'question:1'
		]);
	});
});

describe('text keys', () => {
	it('round-trips', () => {
		expect(parseTextKey(textKey({ itemType: 'letter', id: 92 }))).toEqual({
			itemType: 'letter',
			id: 92
		});
		expect(parseTextKey('question:167')).toEqual({ itemType: 'question', id: 167 });
	});

	it('refuses anything else', () => {
		for (const key of ['story:1', 'letter:', 'letter:1x', 'letter:-1', ' letter:1', '12']) {
			expect(parseTextKey(key)).toBeNull();
		}
	});
});

describe('placeInOrder', () => {
	const current = ['question:3', 'letter:9', 'question:1', 'question:2'];

	it('takes a whole-list move as it is', () => {
		expect(placeInOrder(current, ['question:1', 'question:2', 'letter:9', 'question:3'])).toEqual([
			'question:1',
			'question:2',
			'letter:9',
			'question:3'
		]);
	});

	it('moves part of the list within the places that part held', () => {
		expect(placeInOrder(current, ['question:2', 'question:1', 'question:3'])).toEqual([
			'question:2',
			'letter:9',
			'question:1',
			'question:3'
		]);
	});

	it('drops unknown keys and repeats', () => {
		expect(
			placeInOrder(current, ['letter:1', 'question:2', 'question:2', 'question:3', 'letter:9'])
		).toEqual(['question:2', 'question:3', 'question:1', 'letter:9']);
	});

	it('changes nothing for an empty move', () => {
		expect(placeInOrder(current, [])).toEqual(current);
	});
});
