import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { coerceIndexedEnvelope } from '../structured-envelope';

const Item = z.object({ relation: z.string(), confidence: z.number().optional() });

describe('coerceIndexedEnvelope', () => {
	it('reads the envelope that was asked for', () => {
		const out = coerceIndexedEnvelope(
			{ verdicts: [{ relation: 'broader' }, { relation: 'none' }] },
			'verdicts',
			Item
		);
		expect(out).toEqual([
			{ index: 0, value: { relation: 'broader' } },
			{ index: 1, value: { relation: 'none' } }
		]);
	});

	/** The observed failure this module exists for. */
	it('reads an object keyed by index', () => {
		const out = coerceIndexedEnvelope(
			{ '0': { relation: 'broader' }, '1': { relation: 'requires' } },
			'verdicts',
			Item
		);
		expect(out.map((o) => o.index)).toEqual([0, 1]);
		expect(out[1].value.relation).toBe('requires');
	});

	it('keeps the numeric key as the index, not the position', () => {
		const out = coerceIndexedEnvelope({ '3': { relation: 'broader' } }, 'verdicts', Item);
		expect(out).toEqual([{ index: 3, value: { relation: 'broader' } }]);
	});

	it('drops one bad item rather than failing the batch', () => {
		const out = coerceIndexedEnvelope(
			{ '0': { relation: 'broader' }, '1': { relation: 42 } },
			'verdicts',
			Item
		);
		expect(out).toHaveLength(1);
		expect(out[0].index).toBe(0);
	});

	it('throws when neither reading yields anything', () => {
		expect(() => coerceIndexedEnvelope({ nope: 'sorry' }, 'verdicts', Item)).toThrow(
			/unrecognised verdicts envelope/
		);
		expect(() => coerceIndexedEnvelope('a string', 'verdicts', Item)).toThrow();
	});
});
