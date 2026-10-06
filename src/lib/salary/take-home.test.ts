import { describe, expect, it } from 'vitest';
import type { FxRates } from './conversion';
import { normalizeEmployed, normalizeFreelance } from './settings';
import {
	compareAsks,
	employedYear,
	freelanceYear,
	rateAsSalary,
	rateKeeping,
	salaryAsRate,
	salaryKeeping,
	unitsPerYear
} from './take-home';

const RATES: FxRates = { EUR: 1, USD: 1.1463 };

// Rik's asks as the migration converts them (see settings.test.ts).
const employed = normalizeEmployed({ amount: 8700, taxPct: 40 });
const freelance = normalizeFreelance({ amount: 83, taxPct: 45, costsPerYear: 0 });

describe('employedYear', () => {
	it('counts holiday pay into the year, and the pension as kept but not taken home', () => {
		const year = employedYear(employed)!;
		expect(year.grossPay).toBeCloseTo(112_752); // 8,700 x 12 x 1.08
		expect(year.pension).toBeCloseTo(11_275.2);
		expect(year.tax).toBeCloseTo(45_100.8);
		expect(year.takeHome).toBeCloseTo(67_651.2);
		expect(year.kept).toBeCloseTo(78_926.4);
	});

	it('takes a yearly salary as everything, with no holiday pay on top', () => {
		const year = employedYear(normalizeEmployed({ amount: 90_000, period: 'year' }))!;
		expect(year.grossPay).toBe(90_000);
	});

	it('counts benefits as kept', () => {
		const year = employedYear(normalizeEmployed({ amount: 5000, benefitsPerYear: 6000 }))!;
		expect(year.kept - year.takeHome - year.pension).toBeCloseTo(6000);
	});
});

describe('freelanceYear', () => {
	it('invoices billed hours only, and puts the pension aside before tax', () => {
		const year = freelanceYear(freelance)!;
		expect(year.revenue).toBe(139_440); // 83 x 1,680
		expect(year.pension).toBeCloseTo(13_944);
		expect(year.tax).toBeCloseTo(56_473.2); // 45% of what is left
		expect(year.takeHome).toBeCloseTo(69_022.8);
		expect(year.kept).toBeCloseTo(82_966.8);
	});

	it('pays costs before anything else', () => {
		const year = freelanceYear(normalizeFreelance({ amount: 100, costsPerYear: 8000 }))!;
		expect(year.revenue - year.costs - year.pension - year.tax).toBeCloseTo(year.takeHome);
		expect(year.costs).toBe(8000);
	});

	it('counts a day as eight billed hours and a monthly fee by the days it pays for', () => {
		expect(unitsPerYear(normalizeFreelance({}), 'day')).toBe(210);
		expect(unitsPerYear(normalizeFreelance({ unpaidDays: 21.75 }), 'month')).toBe(11);
		expect(
			freelanceYear(normalizeFreelance({ amount: 10_000, unit: 'month', unpaidDays: 0 }))!.revenue
		).toBe(120_000);
	});
});

describe('the two directions are inverses', () => {
	const cases = [
		{ e: employed, f: freelance },
		{
			e: normalizeEmployed({
				amount: 95_000,
				period: 'year',
				benefitsPerYear: 3000,
				pensionPct: 4
			}),
			f: normalizeFreelance({ amount: 700, unit: 'day', costsPerYear: 9000, pensionPct: 0 })
		},
		{
			e: normalizeEmployed({ amount: 6000, extraPayPct: 16.3, taxPct: 37 }),
			f: normalizeFreelance({ amount: 11_500, unit: 'month', unpaidDays: 22 })
		}
	];

	it.each(cases)('finds the ask back from what it keeps', ({ e, f }) => {
		expect(salaryKeeping(e, employedYear(e)!.kept)).toBeCloseTo(e.amount!, 6);
		expect(rateKeeping(f, freelanceYear(f)!.kept)).toBeCloseTo(f.amount!, 6);
	});
});

describe('compareAsks', () => {
	it("puts Rik's rate a few percent above what his salary is worth", () => {
		const c = compareAsks(employed, freelance, RATES)!;
		// 78,926.4 kept / 0.595 kept per euro of profit / 1,680 hours
		expect(c.breakEvenRate).toBeCloseTo(78.96, 2);
		// 82,966.8 kept / 0.70 kept per euro of salary / 12.96 months
		expect(c.equivalentSalary).toBeCloseTo(9145.37, 1);
		expect(c.rateVsBreakEven).toBeCloseTo(83 / 78.96 - 1, 3);
		expect(c.freelanceKept).toBeCloseTo(82_966.8);
	});

	it('compares across currencies through the exchange rate', () => {
		const usd = normalizeFreelance({
			amount: 11_500,
			unit: 'month',
			currency: 'USD',
			unpaidDays: 22
		});
		const c = compareAsks(employed, usd, RATES)!;
		expect(c.breakEvenRate).not.toBeNull();
		expect(c.equivalentSalary).not.toBeNull();
		// The break-even fee, kept the same way, comes back to the salary.
		const atBreakEven = normalizeFreelance({ ...usd, amount: c.breakEvenRate! });
		expect(compareAsks(employed, atBreakEven, RATES)!.equivalentSalary).toBeCloseTo(8700, -1);
	});

	it('says nothing across currencies it has no rate for', () => {
		const chf = normalizeFreelance({ amount: 120, currency: 'CHF' });
		const c = compareAsks(employed, chf, RATES)!;
		expect(c.breakEvenRate).toBeNull();
		expect(c.equivalentSalary).toBeNull();
		expect(c.freelanceKept).toBeNull();
		expect(c.rateVsBreakEven).toBeNull();
	});

	it('needs both asks', () => {
		expect(compareAsks(normalizeEmployed({}), freelance, RATES)).toBeNull();
		expect(compareAsks(employed, normalizeFreelance({}), RATES)).toBeNull();
	});
});

describe('rateKeeping and salaryKeeping', () => {
	it('give up rather than divide by nothing', () => {
		expect(rateKeeping(normalizeFreelance({ billableHours: 0 }), 50_000)).toBeNull();
		expect(rateKeeping(normalizeFreelance({ taxPct: 100, pensionPct: 0 }), 50_000)).toBeNull();
		expect(salaryKeeping(normalizeEmployed({ taxPct: 100, pensionPct: 0 }), 50_000)).toBeNull();
		expect(salaryKeeping(normalizeEmployed({ benefitsPerYear: 60_000 }), 50_000)).toBeNull();
	});
});

describe("a posting's pay in the other mode", () => {
	it('turns a posted rate into a salary and back', () => {
		const salary = rateAsSalary(
			employed,
			freelance,
			{ amount: 83, unit: 'hour', currency: 'EUR' },
			RATES
		)!;
		expect(salary).toBeCloseTo(9145.37, 1);
		const rate = salaryAsRate(
			employed,
			freelance,
			{ amount: salary, period: 'month', currency: 'EUR' },
			RATES
		)!;
		expect(rate).toBeCloseTo(83, 6);
	});

	it('reads a yearly posting as all-in', () => {
		const rate = salaryAsRate(
			employed,
			freelance,
			{ amount: 112_752, period: 'year', currency: 'EUR' },
			RATES
		);
		expect(rate).toBeCloseTo(78.96, 2);
	});

	it('converts a posting in another currency, and gives up without a rate', () => {
		expect(
			rateAsSalary(employed, freelance, { amount: 95, unit: 'hour', currency: 'USD' }, RATES)
		).not.toBeNull();
		expect(
			rateAsSalary(employed, freelance, { amount: 95, unit: 'hour', currency: 'SEK' }, RATES)
		).toBeNull();
	});
});
