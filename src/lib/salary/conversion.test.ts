import { describe, expect, it } from 'vitest';
import { compareSalary, convertCurrency, type FxRates } from './conversion';

const RATES: FxRates = { EUR: 1, USD: 1.08, GBP: 0.86 };

describe('convertCurrency', () => {
	it('returns the amount unchanged for same-currency (no rates needed)', () => {
		expect(convertCurrency(100, 'EUR', 'EUR', {})).toBe(100);
	});

	it('converts via EUR-based rates', () => {
		// 108 USD -> EUR(100) -> GBP(86)
		expect(convertCurrency(108, 'USD', 'GBP', RATES)).toBe(86);
	});

	it('returns null (not a guess) when a rate is missing', () => {
		expect(convertCurrency(100, 'USD', 'JPY', RATES)).toBeNull();
		expect(convertCurrency(100, 'USD', 'EUR', {})).toBeNull();
	});
});

describe('compareSalary', () => {
	it('returns unknown when the job has no salary range', () => {
		expect(compareSalary(5000, 'EUR', 'month', null, null, 'EUR', 'month', RATES)).toBe('unknown');
	});

	it('classifies within / below / above for same-currency ranges', () => {
		const args = (ask: number) =>
			compareSalary(ask, 'EUR', 'month', 4000, 6000, 'EUR', 'month', RATES);
		expect(args(5000)).toBe('within');
		expect(args(3000)).toBe('below');
		expect(args(7000)).toBe('above');
	});

	it('compares across currencies using the injected rates', () => {
		// €5000/mo ask converts to ~$5400/mo, comfortably inside a $5000-7560 job.
		expect(compareSalary(5000, 'EUR', 'month', 5000, 7560, 'USD', 'month', RATES)).toBe('within');
		// The same ask is clearly below a much higher USD range.
		expect(compareSalary(5000, 'EUR', 'month', 9000, 11000, 'USD', 'month', RATES)).toBe('below');
	});

	it('degrades to unknown (never guesses) when the rate pair is missing', () => {
		// Cross-currency comparison with no usable rate must NOT fall back to a
		// hardcoded number — it must report the comparison as unavailable.
		expect(compareSalary(5000, 'EUR', 'month', 600000, 800000, 'JPY', 'month', RATES)).toBe(
			'unknown'
		);
		expect(compareSalary(5000, 'EUR', 'month', 5400, 7560, 'USD', 'month', {})).toBe('unknown');
	});

	it('still works same-currency even with an empty rate map', () => {
		expect(compareSalary(5000, 'EUR', 'month', 4000, 6000, 'EUR', 'month', {})).toBe('within');
	});
});
