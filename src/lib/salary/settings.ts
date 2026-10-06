/**
 * What an applicant asks to be paid: a salary for a job and a rate for
 * freelance work, each in the unit it is quoted in.
 *
 * Until 2026-10-05 both came from one hourly base rate, with freelancing as a
 * "+65% contract" adjustment on top of it. The same hourly number then had to
 * be an employee's salary and a freelancer's invoice at once, and Salary Prep
 * showed it as three different monthly figures. The two are priced differently:
 * a salary comes with paid leave, holiday pay and a pension, while a rate pays
 * for billed hours only and its costs are your own. So each has its own ask and
 * its own assumptions, and they meet only in `take-home.ts`, which works out
 * what each leaves you and what one is worth in terms of the other.
 *
 * Shared by the browser and the server: the page fills in what it edits with the
 * same functions the server checks a save with.
 */

import { REGION_CURRENCIES } from './conversion';

export type SalaryMode = 'employed' | 'freelance';
export type EmployedPeriod = 'month' | 'year';
export type FreelanceUnit = 'hour' | 'day' | 'month';

/** The ask for jobs in one region. It replaces the main ask and its currency there. */
export type RegionAsk = { amount: number; currency: string };
export type RegionAsks = Record<string, RegionAsk>;

export type EmployedSettings = {
	/** Gross salary per `period`, before tax. Null until they set one. */
	amount: number | null;
	period: EmployedPeriod;
	currency: string;
	/**
	 * Holiday pay and extra months, as a percentage on top of twelve monthly
	 * salaries: 8 is Dutch holiday pay, and a 13th month adds 8.3. Used for a
	 * monthly salary only; a yearly figure is taken to include everything.
	 */
	extraPayPct: number;
	/** What the employer pays into a pension, % of gross pay. */
	pensionPct: number;
	/** Anything else the job pays for, valued a year: a lease car, allowances, a bonus. */
	benefitsPerYear: number;
	/** Income tax and employee contributions, % of gross pay. */
	taxPct: number;
	/** Per region, in the same period. */
	regions: RegionAsks;
};

export type FreelanceSettings = {
	/** Rate per `unit`, as invoiced. Null until they set one. */
	amount: number | null;
	unit: FreelanceUnit;
	currency: string;
	/** Hours invoiced in a year, for an hourly or a daily rate (8 hours to a day). */
	billableHours: number;
	/** Working days off a year that a monthly fee does not pay for. */
	unpaidDays: number;
	/** Business costs and insurance a year: disability cover, an accountant, equipment. */
	costsPerYear: number;
	/** What they put aside for a pension, % of profit, before tax. */
	pensionPct: number;
	/** Income tax and contributions, % of profit after the pension. */
	taxPct: number;
	/** Per region, in the same unit. */
	regions: RegionAsks;
};

/**
 * Percentages that move an ask by what a job is. Those that match a job are
 * added up and applied to the ask the job is priced in: `work_arrangement` and
 * `company_type` to either, `employment_type` (part-time, internship) to the
 * salary only. Contract and freelance are not adjustments any more: they are
 * the freelance ask.
 */
export type SalaryAdjustments = {
	employment_type?: Record<string, number>;
	work_arrangement?: Record<string, number>;
	company_type?: Record<string, number>;
};

/**
 * Defaults for the parts of an ask people rarely know offhand. They lean Dutch,
 * where most users are, and every one is editable on the page.
 *
 * Tax is the same 32% on both sides on purpose: then the comparison is about
 * what each kind of work pays for (holiday pay, pension, unbilled time, costs),
 * not about two tax regimes nobody has entered yet.
 */
export const DEFAULT_EMPLOYED: EmployedSettings = {
	amount: null,
	period: 'month',
	currency: 'EUR',
	extraPayPct: 8,
	pensionPct: 10,
	benefitsPerYear: 0,
	taxPct: 32,
	regions: {}
};

export const DEFAULT_FREELANCE: FreelanceSettings = {
	amount: null,
	unit: 'hour',
	currency: 'EUR',
	// 210 days of 8 hours. Not every working hour gets billed: leave, public
	// holidays, sick days, quiet weeks and finding the next client come out of it.
	billableHours: 1680,
	unpaidDays: 20,
	costsPerYear: 6000,
	pensionPct: 10,
	taxPct: 32,
	regions: {}
};

const CURRENCY = /^[A-Z]{3}$/;
const REGION_KEY = /^[a-z_]+$/;

function asRecord(raw: unknown): Record<string, unknown> {
	return raw && typeof raw === 'object' && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: {};
}

/** A number from a form or a JSON column, clamped; the fallback when there is none. */
function clampedNumber(raw: unknown, fallback: number, min: number, max: number): number {
	const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
	if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
	return Math.min(Math.max(n, min), max);
}

/** A positive whole amount, or null for blank, zero and anything unreadable. */
function amountOrNull(raw: unknown): number | null {
	const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
	return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function currencyOr(raw: unknown, fallback: string): string {
	const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
	return CURRENCY.test(code) ? code : fallback;
}

/**
 * Region asks, keeping a row whose amount is still blank (it shows on the page
 * as a row to fill in) but never letting it price a job: see `askForJob`.
 */
function regionsFrom(raw: unknown, fallbackCurrency: string): RegionAsks {
	const out: RegionAsks = {};
	for (const [region, ask] of Object.entries(asRecord(raw))) {
		if (!REGION_KEY.test(region) || !ask || typeof ask !== 'object') continue;
		const a = ask as Record<string, unknown>;
		out[region] = {
			amount: amountOrNull(a.amount) ?? 0,
			currency: currencyOr(a.currency, REGION_CURRENCIES[region] ?? fallbackCurrency)
		};
	}
	return out;
}

/** A complete salary ask from whatever was stored or posted, defaults filled in. */
export function normalizeEmployed(raw: unknown): EmployedSettings {
	const r = asRecord(raw);
	const d = DEFAULT_EMPLOYED;
	const currency = currencyOr(r.currency, d.currency);
	return {
		amount: amountOrNull(r.amount),
		period: r.period === 'year' ? 'year' : 'month',
		currency,
		extraPayPct: clampedNumber(r.extraPayPct, d.extraPayPct, 0, 100),
		pensionPct: clampedNumber(r.pensionPct, d.pensionPct, 0, 100),
		benefitsPerYear: clampedNumber(r.benefitsPerYear, d.benefitsPerYear, 0, 1e9),
		taxPct: clampedNumber(r.taxPct, d.taxPct, 0, 100),
		regions: regionsFrom(r.regions, currency)
	};
}

/** A complete freelance ask from whatever was stored or posted, defaults filled in. */
export function normalizeFreelance(raw: unknown): FreelanceSettings {
	const r = asRecord(raw);
	const d = DEFAULT_FREELANCE;
	const currency = currencyOr(r.currency, d.currency);
	const unit: FreelanceUnit = r.unit === 'day' || r.unit === 'month' ? r.unit : 'hour';
	return {
		amount: amountOrNull(r.amount),
		unit,
		currency,
		billableHours: clampedNumber(r.billableHours, d.billableHours, 0, 8760),
		unpaidDays: clampedNumber(r.unpaidDays, d.unpaidDays, 0, 261),
		costsPerYear: clampedNumber(r.costsPerYear, d.costsPerYear, 0, 1e9),
		pensionPct: clampedNumber(r.pensionPct, d.pensionPct, 0, 100),
		taxPct: clampedNumber(r.taxPct, d.taxPct, 0, 100),
		regions: regionsFrom(r.regions, currency)
	};
}

/** Null stays null: a mode they have not set up is not one set up with defaults. */
export function storedEmployed(raw: unknown): EmployedSettings | null {
	return raw == null ? null : normalizeEmployed(raw);
}

export function storedFreelance(raw: unknown): FreelanceSettings | null {
	return raw == null ? null : normalizeFreelance(raw);
}

const ADJUSTMENT_GROUPS = ['employment_type', 'work_arrangement', 'company_type'] as const;

/**
 * Whole percentages per option. `employment_type.contract` and `.freelance` are
 * dropped wherever they still turn up (an old export, say): that premium is the
 * freelance ask now, and applying it on top would count it twice.
 */
export function normalizeAdjustments(raw: unknown): SalaryAdjustments {
	const out: SalaryAdjustments = {};
	const r = asRecord(raw);
	for (const group of ADJUSTMENT_GROUPS) {
		const options: Record<string, number> = {};
		for (const [option, pct] of Object.entries(asRecord(r[group]))) {
			if (group === 'employment_type' && (option === 'contract' || option === 'freelance'))
				continue;
			if (typeof pct === 'number' && Number.isFinite(pct)) {
				options[option] = Math.min(Math.max(Math.round(pct), -100), 1000);
			}
		}
		if (Object.keys(options).length > 0) out[group] = options;
	}
	return out;
}

/**
 * Canonical job types (`JOB_TYPES`) whose pay is a freelance rate.
 *
 * The taxonomy files temporary and fixed-term work under `contract` as well
 * ("tijdelijk", "befristet", "CDD"), and that is employment. So a contract job
 * is offered both asks, the rate first; see `modesForJobTypes`.
 */
const FREELANCE_JOB_TYPES = new Set(['contract']);
const EMPLOYED_JOB_TYPES = new Set(['full_time', 'part_time', 'internship']);

/**
 * Which asks a job can be priced in, most likely first, from its canonical job
 * types. A job that says nothing gets both.
 */
export function modesForJobTypes(canonicalTypes: readonly string[]): SalaryMode[] {
	const freelance = canonicalTypes.some((t) => FREELANCE_JOB_TYPES.has(t));
	const employed = canonicalTypes.some((t) => EMPLOYED_JOB_TYPES.has(t));
	if (freelance) return ['freelance', 'employed'];
	if (employed) return ['employed'];
	return ['employed', 'freelance'];
}

/**
 * Which kinds of work a list of canonical job types covers: the ones someone
 * matches on, or a job's own. An empty list means any.
 */
export function wantedModes(canonicalTypes: readonly string[]): Record<SalaryMode, boolean> {
	if (canonicalTypes.length === 0) return { employed: true, freelance: true };
	return {
		employed: canonicalTypes.some((t) => EMPLOYED_JOB_TYPES.has(t)),
		freelance: canonicalTypes.some((t) => FREELANCE_JOB_TYPES.has(t))
	};
}

/** What a job is, as far as the adjustments care. Canonical taxonomy values. */
export type JobContext = {
	employment_type?: string;
	work_arrangement?: string;
	company_type?: string;
	region?: string;
};

export type AppliedAdjustment = {
	group: keyof SalaryAdjustments;
	option: string;
	pct: number;
};

export type JobAsk = {
	amount: number;
	currency: string;
	/** The region whose ask replaced the main one, if any. */
	region: string | null;
	applied: AppliedAdjustment[];
};

/**
 * The ask for one job in one mode: the region's ask when they set one for the
 * job's region, moved by every adjustment that matches the job, added up.
 *
 * A region row whose amount is still blank does not count. It used to: the old
 * calculation took the row's 0 as the rate, and a job in that region was then
 * offered a suggested ask of nothing.
 */
export function askForJob(
	mode: SalaryMode,
	settings: EmployedSettings | FreelanceSettings,
	adjustments: SalaryAdjustments,
	job: JobContext
): JobAsk | null {
	const regional = job.region ? settings.regions[job.region] : undefined;
	const useRegion = regional != null && regional.amount > 0;
	const amount = useRegion ? regional.amount : settings.amount;
	if (amount == null) return null;

	const applied: AppliedAdjustment[] = [];
	const add = (group: keyof SalaryAdjustments, option: string | undefined) => {
		if (option == null) return;
		const pct = adjustments[group]?.[option];
		if (pct != null && pct !== 0) applied.push({ group, option, pct });
	};
	if (mode === 'employed') add('employment_type', job.employment_type);
	add('work_arrangement', job.work_arrangement);
	add('company_type', job.company_type);

	const total = applied.reduce((sum, a) => sum + a.pct, 0);
	return {
		amount: Math.round((amount * (100 + total)) / 100),
		currency: useRegion ? regional.currency : settings.currency,
		region: useRegion ? (job.region ?? null) : null,
		applied
	};
}

/** The columns the old model stored, as a full or settings export still carries them. */
export type LegacySalarySettings = {
	base_rate?: number | null;
	currency?: string | null;
	adjustments?: unknown;
	region_overrides?: unknown;
	income_assumptions?: unknown;
};

/** The hours a month the old page turned the hourly base into (8 x 21.75). */
const LEGACY_HOURS_PER_MONTH = 174;

/** The asks a profile already has, whose assumptions an old export leaves alone. */
export type CurrentAsks = {
	employed?: EmployedSettings | null;
	freelance?: FreelanceSettings | null;
};

/**
 * The two asks an old hourly base rate stood for. Mirrors the data step of the
 * migration that retired those columns (`0070_salary_modes.sql`).
 *
 * The base was in practice the employee rate: the page showed it as a monthly
 * salary (base x 174), and freelancing was the base plus the contract
 * adjustment. Region rates split the same way. Of the old income assumptions,
 * billable hours and both tax rates carry over. The old freelance figure was
 * "tax + contributions + costs" in one percentage, so where someone had set it,
 * it becomes the freelance tax rate with costs at 0, and the costs can be split
 * out of it by hand.
 *
 * An export never carried those income assumptions, so importing one would
 * otherwise reset them to the defaults. Pass the profile's `current` asks and
 * their assumptions stay; only what the export says changes. The migration has
 * none to keep, which is why it and this agree when `current` is empty.
 */
export function fromLegacySalarySettings(
	legacy: LegacySalarySettings,
	current: CurrentAsks = {}
): SalaryAsks {
	const adjustments = normalizeAdjustments(legacy.adjustments);
	const base = amountOrNull(legacy.base_rate);
	if (base == null) return { employed: null, freelance: null, adjustments };

	const employmentType = asRecord(asRecord(legacy.adjustments).employment_type);
	const contract = employmentType.contract ?? employmentType.freelance;
	const contractPct = typeof contract === 'number' && Number.isFinite(contract) ? contract : 0;
	const currency = currencyOr(legacy.currency, 'EUR');
	const income = asRecord(legacy.income_assumptions);
	const hasIncome = Object.keys(income).length > 0;

	const asMonthlySalary = (hourly: number) => Math.round(hourly * LEGACY_HOURS_PER_MONTH);
	const asFreelanceRate = (hourly: number) => Math.round((hourly * (100 + contractPct)) / 100);

	const employedRegions: RegionAsks = {};
	const freelanceRegions: RegionAsks = {};
	for (const [region, override] of Object.entries(asRecord(legacy.region_overrides))) {
		const o = asRecord(override);
		const rate = typeof o.rate === 'number' && Number.isFinite(o.rate) ? o.rate : 0;
		const regionCurrency = currencyOr(o.currency, currency);
		employedRegions[region] = { amount: asMonthlySalary(rate), currency: regionCurrency };
		freelanceRegions[region] = { amount: asFreelanceRate(rate), currency: regionCurrency };
	}

	const given = (value: unknown, key: string) => (value != null ? { [key]: value } : {});
	return {
		employed: normalizeEmployed({
			...current.employed,
			amount: asMonthlySalary(base),
			period: 'month',
			currency,
			...given(income.employmentTaxPct, 'taxPct'),
			regions: employedRegions
		}),
		freelance: normalizeFreelance({
			...current.freelance,
			amount: asFreelanceRate(base),
			unit: 'hour',
			currency,
			...given(income.freelanceBillableHours, 'billableHours'),
			...given(income.freelanceDeductionPct, 'taxPct'),
			...given(hasIncome ? 0 : null, 'costsPerYear'),
			regions: freelanceRegions
		}),
		adjustments
	};
}

export type SalaryAsks = {
	employed: EmployedSettings | null;
	freelance: FreelanceSettings | null;
	adjustments: SalaryAdjustments;
};

/**
 * The asks an export carries, in either shape: `{ employed, freelance,
 * adjustments }`, or the hourly `base_rate` of an export taken before
 * 2026-10-05, converted the way the migration converted the database and
 * keeping the `current` asks' assumptions, which such an export never carried.
 */
export function salaryFromExport(raw: unknown, current: CurrentAsks = {}): SalaryAsks {
	const r = asRecord(raw);
	if ('base_rate' in r) return fromLegacySalarySettings(r as LegacySalarySettings, current);
	return {
		employed: storedEmployed(r.employed),
		freelance: storedFreelance(r.freelance),
		adjustments: normalizeAdjustments(r.adjustments)
	};
}
