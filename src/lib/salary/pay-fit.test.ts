import { describe, expect, it } from 'vitest';
import type { FxRates } from './conversion';
import {
	canonicalJobTypes,
	jobContextFor,
	payFit,
	payFloor,
	payVerdict,
	payVerdictDetail,
	postedPayKind,
	type Asks,
	type PostedPay
} from './pay-fit';
import { normalizeEmployed, normalizeFreelance } from './settings';

const RATES: FxRates = { EUR: 1, USD: 1.08, GBP: 0.86 };

/** €8,700 a month (8% holiday pay, so €112,752 a year) and €83 an hour over 1,680 hours. */
const ASKS: Asks = {
	employed: normalizeEmployed({ amount: 8700, period: 'month', currency: 'EUR' }),
	freelance: normalizeFreelance({ amount: 83, unit: 'hour', currency: 'EUR' }),
	adjustments: {}
};
const SALARY_YEAR = 8700 * 12 * 1.08;
const RATE_YEAR = 83 * 1680;

function job(fields: Partial<PostedPay>): PostedPay {
	return {
		salary_min: null,
		salary_max: null,
		salary_currency: 'EUR',
		salary_period: 'year',
		job_types: ['Full-time'],
		work_location: ['Remote'],
		region: null,
		...fields
	};
}

describe('payFit', () => {
	it('compares a yearly salary with the salary ask, holiday pay included', () => {
		const fit = payFit(job({ salary_min: 90000, salary_max: 110000 }), ASKS, RATES);
		expect(fit?.ask).toBe('employed');
		expect(fit?.ratio).toBeCloseTo(110000 / SALARY_YEAR, 4);
	});

	it('gives a monthly salary the same holiday pay the ask gets', () => {
		const fit = payFit(
			job({ salary_min: 5000, salary_max: 7000, salary_period: 'month' }),
			ASKS,
			RATES
		);
		expect(fit?.ratio).toBeCloseTo(7000 / 8700, 4);
	});

	it('compares a contract rate with the freelance ask, across currencies', () => {
		const fit = payFit(
			job({
				salary_min: 30,
				salary_max: 50,
				salary_currency: 'USD',
				salary_period: 'hour',
				job_types: ['Contract']
			}),
			ASKS,
			RATES
		);
		expect(fit?.ask).toBe('freelance');
		expect(fit?.ratio).toBeCloseTo((50 * 1680) / 1.08 / RATE_YEAR, 3);
	});

	it('turns a daily rate and a monthly fee into the same billable year', () => {
		const daily = payFit(
			job({ salary_max: 600, salary_period: 'day', job_types: ['Freelance'] }),
			ASKS,
			RATES
		);
		expect(daily?.ratio).toBeCloseTo((600 * 210) / RATE_YEAR, 4);

		// A monthly fee pays for the months less the 20 unpaid days a year.
		const monthly = payFit(
			job({ salary_max: 12000, salary_period: 'month', job_types: ['Contract'] }),
			ASKS,
			RATES
		);
		expect(monthly?.ask).toBe('freelance');
		expect(monthly?.ratio).toBeCloseTo((12000 * (12 - 20 / 21.75)) / RATE_YEAR, 4);
	});

	it('reads the top of the range, whichever end it was written in', () => {
		const swapped = payFit(job({ salary_min: 110000, salary_max: 90000 }), ASKS, RATES);
		const onlyMin = payFit(job({ salary_min: 110000 }), ASKS, RATES);
		expect(swapped?.ratio).toBeCloseTo(110000 / SALARY_YEAR, 4);
		expect(onlyMin?.ratio).toBeCloseTo(110000 / SALARY_YEAR, 4);
	});

	it('prices the job with the region ask and the adjustments, as Salary Prep does', () => {
		const asks: Asks = {
			...ASKS,
			employed: normalizeEmployed({
				amount: 8700,
				period: 'month',
				currency: 'EUR',
				regions: { us: { amount: 12000, currency: 'USD' } }
			}),
			adjustments: { work_arrangement: { onsite: 15 } }
		};
		const us = payFit(
			job({ salary_max: 150000, salary_currency: 'USD', region: 'us' }),
			asks,
			RATES
		);
		expect(us?.ratio).toBeCloseTo(150000 / (12000 * 12 * 1.08), 4);

		const onsite = payFit(job({ salary_max: 110000, work_location: ['On-site'] }), asks, RATES);
		expect(onsite?.ratio).toBeCloseTo(110000 / (8700 * 1.15 * 12 * 1.08), 4);
	});

	it('has nothing to say without pay, a period or a currency', () => {
		expect(payFit(job({}), ASKS, RATES)).toBeNull();
		// "£3,452" with no period is most likely a month; reading it as a year would hide it.
		expect(
			payFit(job({ salary_max: 3452, salary_currency: 'GBP', salary_period: null }), ASKS, RATES)
		).toBeNull();
		expect(payFit(job({ salary_max: 90000, salary_currency: null }), ASKS, RATES)).toBeNull();
	});

	it('leaves a fixed price and a weekly figure alone', () => {
		const contract = { job_types: ['Contract'] };
		expect(
			payFit(job({ ...contract, salary_max: 3500, salary_period: 'project' }), ASKS, RATES)
		).toBeNull();
		expect(
			payFit(job({ ...contract, salary_max: 3000, salary_period: 'week' }), ASKS, RATES)
		).toBeNull();
	});

	it('reads a figure no posting pays per its period as a misread, not as low pay', () => {
		// A monthly salary filed as yearly, and an hourly rate filed as monthly.
		expect(
			payFit(job({ salary_min: 2597, salary_max: 3635, job_types: ['Part-time'] }), ASKS, RATES)
		).toBeNull();
		expect(payFit(job({ salary_max: 165, salary_period: 'month' }), ASKS, RATES)).toBeNull();
		// A yearly salary filed as hourly would meet any ask, and is just as wrong.
		expect(
			payFit(
				job({ salary_max: 110000, salary_period: 'hour', job_types: ['Contract'] }),
				ASKS,
				RATES
			)
		).toBeNull();
	});

	it('keeps a low rate that is real', () => {
		const fit = payFit(
			job({
				salary_max: 15,
				salary_currency: 'USD',
				salary_period: 'hour',
				job_types: ['Contract']
			}),
			ASKS,
			RATES
		);
		expect(fit?.ratio).toBeLessThan(0.2);
	});

	it('is null without an ask for that kind of work', () => {
		const salaryOnly: Asks = { ...ASKS, freelance: null };
		const rateJob = job({ salary_max: 50, salary_period: 'hour', job_types: ['Contract'] });
		expect(payFit(rateJob, salaryOnly, RATES)).toBeNull();
		expect(payFit(rateJob, ASKS, RATES)).not.toBeNull();
	});

	it('is null when the exchange rate is missing, never a guess', () => {
		expect(payFit(job({ salary_max: 9000000, salary_currency: 'JPY' }), ASKS, RATES)).toBeNull();
	});

	it('does not compare an hourly wage on a permanent job with a rate', () => {
		expect(payFit(job({ salary_max: 73, salary_period: 'hour' }), ASKS, RATES)).toBeNull();
	});
});

describe('postedPayKind', () => {
	it('reads the period and the job types the way the Salary tab does', () => {
		expect(postedPayKind('hour', ['contract'])).toBe('freelance');
		expect(postedPayKind('hour', [])).toBe('freelance');
		expect(postedPayKind('hour', ['full_time'])).toBeNull();
		expect(postedPayKind('month', ['contract'])).toBe('freelance');
		// "Fulltime, tijdelijk": a fixed-term salary, not a fee.
		expect(postedPayKind('month', ['full_time', 'contract'])).toBe('employed');
		expect(postedPayKind('month', [])).toBe('employed');
		expect(postedPayKind('year', ['contract'])).toBe('employed');
		expect(postedPayKind('project', ['contract'])).toBeNull();
	});
});

describe('jobContextFor', () => {
	it('reads the columns as scraped, labels and all', () => {
		expect(canonicalJobTypes(['Full-time', 'Freelance', 42])).toEqual(['full_time', 'contract']);
		expect(
			jobContextFor({ job_types: ['Part-time'], work_location: ['Hybrid'], region: 'us' })
		).toEqual({
			employment_type: 'part_time',
			work_arrangement: 'hybrid',
			company_type: undefined,
			region: 'us'
		});
	});
});

describe('payVerdict', () => {
	it('splits on the ask and on the ask less the tolerance', () => {
		expect(payVerdict(1.2, 10)).toBe('meets');
		expect(payVerdict(1, 10)).toBe('meets');
		expect(payVerdict(0.95, 10)).toBe('close');
		expect(payVerdict(0.9, 10)).toBe('close');
		expect(payVerdict(0.85, 10)).toBe('below');
		expect(payVerdict(0.95, 0)).toBe('below');
		expect(payVerdict(null, 10)).toBeNull();
	});

	it('keeps the tolerance between none and half the ask', () => {
		expect(payFloor(10)).toBe(0.9);
		expect(payFloor(-5)).toBe(1);
		expect(payFloor(80)).toBe(0.5);
		expect(payFloor(Number.NaN)).toBe(1);
	});

	it('says how far below the ask, never 0%', () => {
		expect(payVerdictDetail(0.46, 'freelance')).toBe(
			'The most it pays is 54% below your freelance rate.'
		);
		expect(payVerdictDetail(0.999, 'employed')).toBe(
			'The most it pays is 1% below your salary ask.'
		);
		expect(payVerdictDetail(1.3, 'employed')).toBe(
			'The most it pays is at or above your salary ask.'
		);
	});
});
