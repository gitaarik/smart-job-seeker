import type { EmployedPeriod, FreelanceUnit } from '$lib/salary/settings';

/** The currencies offered for an ask. A stored one outside the list is added back by `currencyOptions`. */
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'];

export function currencyOptions(current: string): string[] {
	return CURRENCIES.includes(current) ? CURRENCIES : [...CURRENCIES, current];
}

const PERIOD_LABELS: Record<EmployedPeriod, string> = { month: 'a month', year: 'a year' };
const UNIT_LABELS: Record<FreelanceUnit, string> = {
	hour: 'an hour',
	day: 'a day',
	month: 'a month'
};

export const PERIODS = (Object.keys(PERIOD_LABELS) as EmployedPeriod[]).map((value) => ({
	value,
	label: PERIOD_LABELS[value]
}));
export const UNITS = (Object.keys(UNIT_LABELS) as FreelanceUnit[]).map((value) => ({
	value,
	label: UNIT_LABELS[value]
}));

export const periodLabel = (period: EmployedPeriod) => PERIOD_LABELS[period];
export const unitLabel = (unit: FreelanceUnit) => UNIT_LABELS[unit];

export const INPUT_CLASS =
	'rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-2.5 py-1.5 text-sm text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none';

/** What a number input holds: a number, or null while it is blank or unreadable. */
export function numberOrNull(value: string): number | null {
	if (value.trim() === '') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}
