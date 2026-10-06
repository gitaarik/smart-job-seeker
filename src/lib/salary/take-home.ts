/**
 * What an ask leaves you, and what it is worth as the other kind of work.
 *
 * Both are compared on what you keep a year: take-home pay plus pension, plus
 * whatever else a job pays for. The pension counts because it is pay, only
 * later: an employer's contribution is money spent on you, and a freelancer who
 * wants the same has to fund it out of the rate. Take-home alone would make a
 * job with a good pension look worse than it is.
 *
 * Flat percentages, not tax tables. The question is whether one offer beats the
 * other on the same footing, not what to file, and the page says so.
 */

import { convertCurrency, type FxRates } from './conversion';
import type {
	EmployedPeriod,
	EmployedSettings,
	FreelanceSettings,
	FreelanceUnit
} from './settings';

const MONTHS_PER_YEAR = 12;
const HOURS_PER_DAY = 8;
const DAYS_PER_MONTH = 21.75;

/** A year of a salary, in its currency. */
export type EmployedYear = {
	currency: string;
	/** The year's salary, holiday pay and extra months included. */
	grossPay: number;
	/** The employer's pension contribution. */
	pension: number;
	benefits: number;
	tax: number;
	takeHome: number;
	/** Take-home plus pension plus benefits: what the comparison weighs. */
	kept: number;
};

/** A year of a freelance rate, in its currency. */
export type FreelanceYear = {
	currency: string;
	/** What the rate invoices in a year. */
	revenue: number;
	costs: number;
	/** Put aside for a pension, before tax. */
	pension: number;
	tax: number;
	takeHome: number;
	/** Take-home plus pension: what the comparison weighs. */
	kept: number;
};

/** A year's gross pay from a salary quoted per `period`. */
export function grossPayPerYear(
	s: Pick<EmployedSettings, 'extraPayPct'>,
	amount: number,
	period: EmployedPeriod
): number {
	return period === 'month' ? amount * MONTHS_PER_YEAR * (1 + s.extraPayPct / 100) : amount;
}

export function employedYear(
	s: EmployedSettings,
	amount: number | null = s.amount
): EmployedYear | null {
	if (amount == null) return null;
	const grossPay = grossPayPerYear(s, amount, s.period);
	const pension = (grossPay * s.pensionPct) / 100;
	const tax = (grossPay * s.taxPct) / 100;
	const takeHome = grossPay - tax;
	return {
		currency: s.currency,
		grossPay,
		pension,
		benefits: s.benefitsPerYear,
		tax,
		takeHome,
		kept: takeHome + pension + s.benefitsPerYear
	};
}

/**
 * How many of a rate's units a year pays for: billed hours, billed days, or the
 * months of a monthly fee less the days off it does not pay for.
 */
export function unitsPerYear(
	s: Pick<FreelanceSettings, 'billableHours' | 'unpaidDays'>,
	unit: FreelanceUnit
): number {
	switch (unit) {
		case 'hour':
			return s.billableHours;
		case 'day':
			return s.billableHours / HOURS_PER_DAY;
		case 'month':
			return Math.max(MONTHS_PER_YEAR - s.unpaidDays / DAYS_PER_MONTH, 0);
	}
}

export function freelanceYear(
	s: FreelanceSettings,
	amount: number | null = s.amount,
	unit: FreelanceUnit = s.unit
): FreelanceYear | null {
	if (amount == null) return null;
	const revenue = amount * unitsPerYear(s, unit);
	const costs = Math.min(s.costsPerYear, revenue);
	const profit = revenue - costs;
	const pension = (profit * s.pensionPct) / 100;
	const tax = ((profit - pension) * s.taxPct) / 100;
	const takeHome = profit - pension - tax;
	return { currency: s.currency, revenue, costs, pension, tax, takeHome, kept: takeHome + pension };
}

/** The share of a freelancer's profit they keep: the pension untaxed, the rest after tax. */
function keptShareOfProfit(s: FreelanceSettings): number {
	return 1 - (1 - s.pensionPct / 100) * (s.taxPct / 100);
}

/** The share of a gross salary kept: take-home plus the employer's pension. */
function keptShareOfGrossPay(s: EmployedSettings): number {
	return 1 - s.taxPct / 100 + s.pensionPct / 100;
}

/**
 * The rate, per `s.unit` and in `s.currency`, that keeps `kept` a year by the
 * freelance assumptions. Null when nothing could: no billable time, or a tax
 * rate that takes everything.
 */
export function rateKeeping(s: FreelanceSettings, kept: number): number | null {
	const share = keptShareOfProfit(s);
	const units = unitsPerYear(s, s.unit);
	if (share <= 0 || units <= 0 || kept <= 0) return null;
	return (kept / share + s.costsPerYear) / units;
}

/** The salary, per `s.period` and in `s.currency`, that keeps `kept` a year by the salary assumptions. */
export function salaryKeeping(s: EmployedSettings, kept: number): number | null {
	const share = keptShareOfGrossPay(s);
	const fromPay = kept - s.benefitsPerYear;
	if (share <= 0 || fromPay <= 0) return null;
	const grossPay = fromPay / share;
	return s.period === 'month' ? grossPay / (MONTHS_PER_YEAR * (1 + s.extraPayPct / 100)) : grossPay;
}

export type AskComparison = {
	employed: EmployedYear;
	freelance: FreelanceYear;
	/** The freelance year's `kept`, in the salary's currency. Null without an exchange rate. */
	freelanceKept: number | null;
	/** The rate that keeps what the salary keeps, in the rate's unit and currency. */
	breakEvenRate: number | null;
	/** The salary that keeps what the rate keeps, in the salary's period and currency. */
	equivalentSalary: number | null;
	/** How far the rate sits above (positive) or below the break-even rate, as a fraction. */
	rateVsBreakEven: number | null;
};

/**
 * The salary ask against the freelance ask. Across currencies both directions
 * go through `rates`, and anything that needs a rate there is not one comes back
 * null rather than guessed.
 */
export function compareAsks(
	e: EmployedSettings,
	f: FreelanceSettings,
	rates: FxRates
): AskComparison | null {
	const employed = employedYear(e);
	const freelance = freelanceYear(f);
	if (!employed || !freelance || f.amount == null) return null;

	const employedKeptAsFreelance = convertCurrency(employed.kept, e.currency, f.currency, rates);
	const freelanceKept = convertCurrency(freelance.kept, f.currency, e.currency, rates);
	const breakEvenRate =
		employedKeptAsFreelance == null ? null : rateKeeping(f, employedKeptAsFreelance);
	return {
		employed,
		freelance,
		freelanceKept,
		breakEvenRate,
		equivalentSalary: freelanceKept == null ? null : salaryKeeping(e, freelanceKept),
		rateVsBreakEven: breakEvenRate ? f.amount / breakEvenRate - 1 : null
	};
}

/**
 * A rate someone else quoted (a posting's), as the salary that keeps the same
 * by these assumptions: per `e.period`, in `e.currency`. The rate is converted
 * into the freelance currency first, since the costs are counted in it.
 */
export function rateAsSalary(
	e: EmployedSettings,
	f: FreelanceSettings,
	rate: { amount: number; unit: FreelanceUnit; currency: string },
	rates: FxRates
): number | null {
	const amount = convertCurrency(rate.amount, rate.currency, f.currency, rates);
	const year = amount == null ? null : freelanceYear(f, amount, rate.unit);
	const kept = year == null ? null : convertCurrency(year.kept, f.currency, e.currency, rates);
	return kept == null ? null : salaryKeeping(e, kept);
}

/**
 * A salary someone else quoted (a posting's), as the rate that keeps the same
 * by these assumptions: per `f.unit`, in `f.currency`. The salary is converted
 * into the salary currency first, since the benefits are counted in it.
 */
export function salaryAsRate(
	e: EmployedSettings,
	f: FreelanceSettings,
	salary: { amount: number; period: EmployedPeriod; currency: string },
	rates: FxRates
): number | null {
	const amount = convertCurrency(salary.amount, salary.currency, e.currency, rates);
	const year = amount == null ? null : employedYear({ ...e, period: salary.period }, amount);
	const kept = year == null ? null : convertCurrency(year.kept, e.currency, f.currency, rates);
	return kept == null ? null : rateKeeping(f, kept);
}
