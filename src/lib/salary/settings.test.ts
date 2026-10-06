import { describe, expect, it } from 'vitest';
import {
	askForJob,
	DEFAULT_EMPLOYED,
	DEFAULT_FREELANCE,
	fromLegacySalarySettings,
	modesForJobTypes,
	normalizeAdjustments,
	normalizeEmployed,
	normalizeFreelance,
	salaryFromExport,
	storedEmployed,
	wantedModes
} from './settings';

describe('normalizeEmployed', () => {
	it('fills in the defaults for anything missing', () => {
		expect(normalizeEmployed({})).toEqual(DEFAULT_EMPLOYED);
		expect(normalizeEmployed(null)).toEqual(DEFAULT_EMPLOYED);
	});

	it('reads numbers posted as strings, and treats blank, zero and junk as no amount', () => {
		expect(normalizeEmployed({ amount: '7500' }).amount).toBe(7500);
		expect(normalizeEmployed({ amount: '' }).amount).toBeNull();
		expect(normalizeEmployed({ amount: 0 }).amount).toBeNull();
		expect(normalizeEmployed({ amount: -5 }).amount).toBeNull();
		expect(normalizeEmployed({ amount: 'lots' }).amount).toBeNull();
	});

	it('clamps percentages and keeps a yearly period', () => {
		const s = normalizeEmployed({ period: 'year', taxPct: 140, pensionPct: -3 });
		expect(s.period).toBe('year');
		expect(s.taxPct).toBe(100);
		expect(s.pensionPct).toBe(0);
	});

	it('takes a currency code in any case and falls back on anything else', () => {
		expect(normalizeEmployed({ currency: 'usd' }).currency).toBe('USD');
		expect(normalizeEmployed({ currency: 'dollars' }).currency).toBe('EUR');
	});

	it('keeps a region row that is still blank, defaulting its currency to the region', () => {
		const s = normalizeEmployed({ regions: { canada: { amount: '' }, us: { amount: 9000 } } });
		expect(s.regions).toEqual({
			canada: { amount: 0, currency: 'CAD' },
			us: { amount: 9000, currency: 'USD' }
		});
	});
});

describe('normalizeFreelance', () => {
	it('fills in the defaults and keeps a daily or monthly unit', () => {
		expect(normalizeFreelance(undefined)).toEqual(DEFAULT_FREELANCE);
		expect(normalizeFreelance({ unit: 'day' }).unit).toBe('day');
		expect(normalizeFreelance({ unit: 'month' }).unit).toBe('month');
		expect(normalizeFreelance({ unit: 'week' }).unit).toBe('hour');
	});
});

describe('storedEmployed', () => {
	it('leaves a mode that was never set up as null, not as defaults', () => {
		expect(storedEmployed(null)).toBeNull();
		expect(storedEmployed({ amount: 5000 })?.amount).toBe(5000);
	});
});

describe('normalizeAdjustments', () => {
	it('drops the old contract premium, which is the freelance ask now', () => {
		expect(
			normalizeAdjustments({
				employment_type: { contract: 65, freelance: 65, part_time: 5 },
				work_arrangement: { onsite: 15 }
			})
		).toEqual({ employment_type: { part_time: 5 }, work_arrangement: { onsite: 15 } });
	});

	it('rounds, and drops what is not a number and groups left empty', () => {
		expect(
			normalizeAdjustments({
				company_type: { startup: -14.6, agency: 'x' },
				employment_type: { contract: 50 }
			})
		).toEqual({ company_type: { startup: -15 } });
	});
});

describe('modesForJobTypes', () => {
	it('prices a permanent job as a salary only', () => {
		expect(modesForJobTypes(['full_time'])).toEqual(['employed']);
		expect(modesForJobTypes(['part_time', 'internship'])).toEqual(['employed']);
	});

	it('offers a contract job both, the rate first: the taxonomy files fixed-term jobs there too', () => {
		expect(modesForJobTypes(['contract'])).toEqual(['freelance', 'employed']);
		expect(modesForJobTypes(['full_time', 'contract'])).toEqual(['freelance', 'employed']);
	});

	it('offers both when the job says nothing', () => {
		expect(modesForJobTypes([])).toEqual(['employed', 'freelance']);
	});
});

describe('wantedModes', () => {
	it('reads the job types someone matches on', () => {
		expect(wantedModes(['full_time', 'part_time'])).toEqual({ employed: true, freelance: false });
		expect(wantedModes(['contract'])).toEqual({ employed: false, freelance: true });
		expect(wantedModes([])).toEqual({ employed: true, freelance: true });
	});
});

describe('askForJob', () => {
	const employed = normalizeEmployed({
		amount: 7000,
		regions: { us: { amount: 9000, currency: 'USD' }, uk: { amount: 0, currency: 'GBP' } }
	});
	const freelance = normalizeFreelance({ amount: 90 });
	const adjustments = normalizeAdjustments({
		employment_type: { part_time: 10 },
		work_arrangement: { onsite: 15, hybrid: 5 },
		company_type: { startup: -10 }
	});

	it('adds up every adjustment that matches and applies it to the ask', () => {
		const ask = askForJob('employed', employed, adjustments, {
			employment_type: 'part_time',
			work_arrangement: 'onsite',
			company_type: 'startup'
		});
		expect(ask).toEqual({
			amount: 8050,
			currency: 'EUR',
			region: null,
			applied: [
				{ group: 'employment_type', option: 'part_time', pct: 10 },
				{ group: 'work_arrangement', option: 'onsite', pct: 15 },
				{ group: 'company_type', option: 'startup', pct: -10 }
			]
		});
	});

	it('moves a freelance rate by where and for whom, never by the employment type', () => {
		const ask = askForJob('freelance', freelance, adjustments, {
			employment_type: 'part_time',
			work_arrangement: 'hybrid'
		});
		expect(ask?.amount).toBe(95);
		expect(ask?.applied.map((a) => a.option)).toEqual(['hybrid']);
	});

	it("uses the region's ask and currency in its place", () => {
		const ask = askForJob('employed', employed, adjustments, { region: 'us' });
		expect(ask).toMatchObject({ amount: 9000, currency: 'USD', region: 'us' });
	});

	it('ignores a region row still left blank instead of asking nothing', () => {
		const ask = askForJob('employed', employed, adjustments, { region: 'uk' });
		expect(ask).toMatchObject({ amount: 7000, currency: 'EUR', region: null });
	});

	it('has nothing to offer before an ask is set', () => {
		expect(askForJob('employed', DEFAULT_EMPLOYED, adjustments, {})).toBeNull();
	});
});

describe('fromLegacySalarySettings', () => {
	it("splits Rik's base rate into the salary it showed and the rate the premium made", () => {
		// profile 1 on dev and preview, 2026-10-05
		const converted = fromLegacySalarySettings({
			base_rate: 50,
			currency: 'EUR',
			adjustments: {
				employment_type: { contract: 65, freelance: 65 },
				work_arrangement: { onsite: 15, hybrid: 10 },
				company_type: { startup: -15, corporate: 5 }
			},
			region_overrides: {},
			income_assumptions: {
				employmentTaxPct: 40,
				freelanceDeductionPct: 45,
				freelanceBillableHours: 1680
			}
		});
		expect(converted.employed).toEqual({
			...DEFAULT_EMPLOYED,
			amount: 8700,
			taxPct: 40
		});
		expect(converted.freelance).toEqual({
			...DEFAULT_FREELANCE,
			amount: 83,
			billableHours: 1680,
			// The old figure included costs, so it becomes the tax rate with costs at 0.
			taxPct: 45,
			costsPerYear: 0
		});
		expect(converted.adjustments).toEqual({
			work_arrangement: { onsite: 15, hybrid: 10 },
			company_type: { startup: -15, corporate: 5 }
		});
	});

	it('splits a region rate the same way, keeping its currency', () => {
		const converted = fromLegacySalarySettings({
			base_rate: 50,
			currency: 'EUR',
			adjustments: { employment_type: { contract: 50, freelance: 50 } },
			region_overrides: { us: { rate: 60, currency: 'USD' } }
		});
		expect(converted.employed?.regions).toEqual({ us: { amount: 10440, currency: 'USD' } });
		expect(converted.freelance?.regions).toEqual({ us: { amount: 90, currency: 'USD' } });
		// No income assumptions were ever saved, so the new defaults apply.
		expect(converted.freelance?.costsPerYear).toBe(DEFAULT_FREELANCE.costsPerYear);
	});

	it('sets up neither ask without a base rate, keeping the adjustments', () => {
		expect(
			fromLegacySalarySettings({
				base_rate: null,
				adjustments: { work_arrangement: { onsite: 5 } }
			})
		).toEqual({
			employed: null,
			freelance: null,
			adjustments: { work_arrangement: { onsite: 5 } }
		});
	});
});

describe('salaryFromExport', () => {
	it('reads an export in the current shape', () => {
		expect(
			salaryFromExport({
				employed: { amount: 6500 },
				freelance: null,
				adjustments: { work_arrangement: { onsite: 10 } }
			})
		).toEqual({
			employed: { ...DEFAULT_EMPLOYED, amount: 6500 },
			freelance: null,
			adjustments: { work_arrangement: { onsite: 10 } }
		});
	});

	it('keeps the assumptions the profile has, which an old export never carried', () => {
		const current = {
			employed: normalizeEmployed({ amount: 9000, period: 'year', taxPct: 40, pensionPct: 12 }),
			freelance: normalizeFreelance({
				amount: 90,
				taxPct: 45,
				costsPerYear: 0,
				billableHours: 1500
			})
		};
		const asks = salaryFromExport(
			{ base_rate: 50, currency: 'EUR', adjustments: { employment_type: { contract: 65 } } },
			current
		);
		expect(asks.employed).toMatchObject({
			amount: 8700,
			period: 'month',
			taxPct: 40,
			pensionPct: 12
		});
		expect(asks.freelance).toMatchObject({
			amount: 83,
			taxPct: 45,
			costsPerYear: 0,
			billableHours: 1500
		});
	});

	it('converts an export taken before the split', () => {
		const asks = salaryFromExport({
			base_rate: 50,
			currency: 'EUR',
			adjustments: { employment_type: { contract: 65 } },
			region_overrides: {}
		});
		expect(asks.employed?.amount).toBe(8700);
		expect(asks.freelance?.amount).toBe(83);
	});
});
