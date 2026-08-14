/**
 * Tests for the one field-coercion vocabulary.
 *
 * The behaviours worth pinning are the ones that used to differ depending on
 * which door an edit came through: a date must stay the `YYYY-MM-DD` string its
 * column holds rather than becoming a `Date`, and "not mentioned" must stay
 * distinguishable from "cleared" all the way to the write.
 */

import { describe, expect, it } from 'vitest';
import { coerceField, coerceFields, coerceValue } from '../field-kinds';

describe('coerceField', () => {
	describe('empty values', () => {
		it.each([null, undefined, ''])('reads %j as "clear this column"', (value) => {
			expect(coerceField('string', value)).toEqual({ ok: true, value: null });
		});

		it('clears a date rather than failing on it', () => {
			expect(coerceField('date', '')).toEqual({ ok: true, value: null });
		});
	});

	describe('date', () => {
		it('keeps a YYYY-MM-DD string as a string', () => {
			// The columns are Drizzle date() — string mode. A Date here would be
			// serialized in the server's local timezone and could land a day out.
			expect(coerceField('date', '2020-05-15')).toEqual({ ok: true, value: '2020-05-15' });
		});

		it('takes the date part of an ISO datetime', () => {
			expect(coerceField('date', '2020-05-15T22:30:00.000Z')).toEqual({
				ok: true,
				value: '2020-05-15'
			});
		});

		it('converts a Date in UTC, not local time', () => {
			expect(coerceField('date', new Date('2020-05-15T00:00:00.000Z'))).toEqual({
				ok: true,
				value: '2020-05-15'
			});
		});

		it('refuses something that is not a date instead of silently clearing it', () => {
			const result = coerceField('date', 'sometime in 2019');
			expect(result.ok).toBe(false);
			expect(result).toMatchObject({ error: expect.stringContaining('YYYY-MM-DD') });
		});

		it('refuses an invalid Date', () => {
			expect(coerceField('date', new Date('nope')).ok).toBe(false);
		});
	});

	describe('int', () => {
		it('takes a plain number', () => {
			expect(coerceField('int', 2015)).toEqual({ ok: true, value: 2015 });
		});

		it('takes the string an HTML number input posts', () => {
			expect(coerceField('int', '2015')).toEqual({ ok: true, value: 2015 });
		});

		it('strips the separators a model adds', () => {
			expect(coerceField('int', '55,000')).toEqual({ ok: true, value: 55000 });
		});

		it('rounds rather than storing a fraction in an integer column', () => {
			expect(coerceField('int', 3.7)).toEqual({ ok: true, value: 4 });
		});

		it('refuses a non-number', () => {
			expect(coerceField('int', 'many').ok).toBe(false);
		});
	});

	describe('stringArray', () => {
		it('keeps a list', () => {
			expect(coerceField('stringArray', ['a', 'b'])).toEqual({ ok: true, value: ['a', 'b'] });
		});

		it('splits the comma-joined string a model sends instead of a list', () => {
			expect(coerceField('stringArray', 'a, b')).toEqual({ ok: true, value: ['a', 'b'] });
		});

		it('drops empties and reads an all-empty list as cleared', () => {
			expect(coerceField('stringArray', [' ', ''])).toEqual({ ok: true, value: null });
		});
	});

	describe('string', () => {
		it('trims', () => {
			expect(coerceField('string', '  hi  ')).toEqual({ ok: true, value: 'hi' });
		});

		it('reads whitespace-only as cleared', () => {
			expect(coerceField('string', '   ')).toEqual({ ok: true, value: null });
		});
	});
});

describe('coerceValue', () => {
	it('swallows a refusal to null, for callers with no one to report it to', () => {
		// A model writing prose into a date field is proposing nothing; the card
		// showing that field unchanged beats the whole turn failing.
		expect(coerceValue('date', 'sometime in 2019')).toBeNull();
		expect(coerceValue('int', 'many')).toBeNull();
	});

	it('agrees with coerceField everywhere else', () => {
		expect(coerceValue('date', '2020-05-15')).toBe('2020-05-15');
	});
});

describe('coerceFields', () => {
	const kinds = { name: 'string', start_date: 'date', stars: 'int' } as const;

	it('keeps only the fields the caller sent', () => {
		const result = coerceFields(kinds, { name: 'Thing' });
		expect(result).toEqual({ ok: true, values: { name: 'Thing' } });
	});

	it('treats an explicit null as "clear it" and an absent key as "leave it"', () => {
		const result = coerceFields(kinds, { name: null });
		expect(result).toEqual({ ok: true, values: { name: null } });
	});

	it('ignores an explicit undefined the same as an absent key', () => {
		expect(coerceFields(kinds, { name: undefined })).toEqual({ ok: true, values: {} });
	});

	it('ignores fields the resource has not declared', () => {
		expect(coerceFields(kinds, { name: 'Thing', sneaky: 'value' })).toEqual({
			ok: true,
			values: { name: 'Thing' }
		});
	});

	it('names the field that failed', () => {
		expect(coerceFields(kinds, { name: 'Thing', start_date: 'whenever' })).toMatchObject({
			ok: false,
			field: 'start_date'
		});
	});
});
