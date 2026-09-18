/**
 * The one behaviour this class exists for: a row keeps its own open state
 * across a delete somewhere else in the list.
 *
 * Under the index-keyed version these lists used, removing a row shifted every
 * entry after it, so the set kept opening the row that had moved into the
 * deleted one's place.
 */

import { describe, expect, it } from 'vitest';
import { OpenRows } from '../open-rows';

interface Row {
	name: string;
}

describe('OpenRows', () => {
	it('follows the row through a delete earlier in the list', () => {
		const rows: Row[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
		const open = new OpenRows<Row>();
		open.open(rows[2]);

		const remaining = rows.filter((r) => r !== rows[1]);

		expect(open.has(remaining[0])).toBe(false); // a
		expect(open.has(remaining[1])).toBe(true); // c, still the one that was open
	});

	it('follows the row through a reorder', () => {
		const rows: Row[] = [{ name: 'a' }, { name: 'b' }];
		const open = new OpenRows<Row>();
		open.open(rows[0]);

		const reordered = [rows[1], rows[0]];

		expect(open.has(reordered[0])).toBe(false);
		expect(open.has(reordered[1])).toBe(true);
	});

	it('toggles', () => {
		const row = { name: 'a' };
		const open = new OpenRows<Row>();

		expect(open.has(row)).toBe(false);
		open.toggle(row);
		expect(open.has(row)).toBe(true);
		open.toggle(row);
		expect(open.has(row)).toBe(false);
	});

	it('takes rows to start open', () => {
		const rows: Row[] = [{ name: 'a' }, { name: 'b' }];
		const open = new OpenRows<Row>(rows.slice(0, 1));

		expect(open.has(rows[0])).toBe(true);
		expect(open.has(rows[1])).toBe(false);
	});

	it('opens nothing for a row that is no longer there', () => {
		// A copy is a different row, which is what a wholesale replacement
		// produces — the set matches nothing rather than matching the wrong one.
		const row = { name: 'a' };
		const open = new OpenRows<Row>();
		open.open(row);

		expect(open.has({ ...row })).toBe(false);
		expect(open.has(undefined)).toBe(false);
	});
});
