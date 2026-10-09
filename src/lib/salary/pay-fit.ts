/**
 * Whether a posting pays what this profile asks for.
 *
 * The matcher never sees pay, on purpose: a high score means the role fits, and
 * about half of all postings say nothing about pay. That leaves a perfect skill
 * fit at a third of someone's rate at the top of their list. This is the other
 * half: one number per match, the top of the posted pay as a share of the ask
 * that applies to it. The job list, the home page and the email digest filter
 * on it, and the job card shows it. It never feeds the score.
 *
 * A posting is read the way the application's Salary tab reads it, and the
 * rules live here so the two cannot drift: a rate or a fee is compared with the
 * freelance ask and a salary with the salary ask, decided by the job's types and
 * the period its pay is quoted in, through the same `askForJob` (region asks and
 * adjustments included).
 *
 * Anything it cannot read is null, and null is never filtered: no pay, no
 * period, no currency, a fixed price, a currency without an exchange rate, no
 * ask for that kind of work, or a figure no real posting pays per that period.
 * Hiding a good job on a misread is worse than showing a poor one.
 */

import { JOB_TYPES, WORK_LOCATIONS, buildNormalizeMap, getPatterns } from '$lib/data/job-taxonomy';
import {
	convertCurrency,
	normalizeSalaryPeriod,
	type FxRates,
	type SalaryPeriod
} from './conversion';
import {
	askForJob,
	modesForJobTypes,
	wantedModes,
	type EmployedSettings,
	type FreelanceSettings,
	type JobContext,
	type SalaryAdjustments,
	type SalaryMode
} from './settings';
import { grossPayPerYear, unitsPerYear } from './take-home';

const jobTypeNormalize = buildNormalizeMap(JOB_TYPES);
const workLocationNormalize = buildNormalizeMap(WORK_LOCATIONS);
const workLocationPatterns = getPatterns(WORK_LOCATIONS);

function strings(raw: unknown): string[] {
	return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

/** A job's types as canonical taxonomy values (`contract`, `full_time`, ...). */
export function canonicalJobTypes(raw: unknown): string[] {
	return strings(raw).map((t) => jobTypeNormalize.get(t.toLowerCase()) ?? t.toLowerCase());
}

/** A posting's work location as the arrangement the adjustments are keyed by. */
export function salaryWorkArrangement(location: string): string {
	const lower = location.toLowerCase().trim();
	const canonical = workLocationNormalize.get(lower);
	if (canonical) return canonical;
	for (const p of workLocationPatterns) {
		if (p.mode === 'includes' && lower.includes(p.pattern)) return p.canonical;
		if (p.mode === 'startsWith' && lower.startsWith(p.pattern)) return p.canonical;
	}
	return lower;
}

/**
 * What the adjustments need to know about a job, from its columns. Postings
 * never say what kind of company it is, so a caller that knows passes it.
 */
export function jobContextFor(
	job: { job_types: unknown; work_location: unknown; region: string | null | undefined },
	companyType?: string
): JobContext {
	const types = canonicalJobTypes(job.job_types);
	const locations = strings(job.work_location);
	return {
		employment_type: ['internship', 'part_time', 'full_time'].find((t) => types.includes(t)),
		work_arrangement: locations.length > 0 ? salaryWorkArrangement(locations[0]) : undefined,
		company_type: companyType || undefined,
		region: job.region ?? undefined
	};
}

/**
 * Which ask a posting's pay is quoted against: a rate or a fee is `freelance`,
 * a salary `employed`, and null for anything else (an hourly wage on a
 * permanent job, a weekly figure, a fixed price).
 *
 * An hourly or daily figure is a rate unless the job is permanent (then it is a
 * wage, and there is no rate to compare it with). A monthly one is a fee only
 * on a contract job with no permanent type beside it: a job typed both
 * full-time and contract is the Dutch "fulltime, tijdelijk", a fixed-term
 * salary. Anything else is a salary.
 */
export function postedPayKind(
	period: SalaryPeriod | null,
	jobTypes: readonly string[]
): SalaryMode | null {
	const modes = modesForJobTypes(jobTypes);
	const kinds = wantedModes(jobTypes);
	const isRate =
		period === 'hour' || period === 'day'
			? modes.includes('freelance')
			: period === 'month' && kinds.freelance && !kinds.employed;
	if (isRate) return 'freelance';
	if ((period === 'month' || period === 'year') && modes.includes('employed')) return 'employed';
	return null;
}

/** The asks a profile has set up, as Salary Prep stores them. Null for a kind not set up. */
export type Asks = {
	employed: EmployedSettings | null;
	freelance: FreelanceSettings | null;
	adjustments: SalaryAdjustments;
};

/** The columns of a posting that say what it pays and what kind of job it is. */
export type PostedPay = {
	salary_min: number | null;
	salary_max: number | null;
	salary_currency: string | null;
	salary_period: string | null;
	job_types: unknown;
	work_location: unknown;
	region: string | null;
};

export type PayFit = {
	/** The top of the posted pay as a share of the ask: 1 meets it, 0.5 pays half. */
	ratio: number;
	/** Which ask it was compared with. */
	ask: SalaryMode;
};

/**
 * What a figure can be per period, in euros, before it is more likely a misread
 * than a posting. Wide on purpose: this only has to catch a period the
 * extractor got wrong, and a wrong one is out by a factor of eight or more (a
 * monthly salary filed as yearly, a yearly one as hourly). A low hourly rate is
 * real, so the hour's floor only drops a stray "1". The year's floor is where a
 * monthly salary filed as yearly lands, at the cost of also reading a genuinely
 * low yearly salary, under about €10,000, as unknown.
 */
const PLAUSIBLE_EUR = {
	hour: [3, 1_000],
	day: [80, 8_000],
	month: [400, 100_000],
	year: [10_000, 1_500_000]
} as const;

/** Four decimals: enough to tell 0.9 from 0.8999, and stable across refreshes. */
function rounded(ratio: number): number {
	return Math.round(ratio * 10_000) / 10_000;
}

/**
 * The top of a posting's pay as a share of the ask that applies to it, or null
 * when the two cannot be compared (see the top of this file for every case).
 *
 * The top of the range, because a filter built on it hides a job only when even
 * the most it says it pays falls short. Both sides become a year before they
 * meet, in the ask's terms: a salary through the ask's own holiday pay, a rate
 * through its billable hours, so a monthly fee and an hourly rate compare the
 * way Salary Prep compares them.
 */
export function payFit(job: PostedPay, asks: Asks, rates: FxRates): PayFit | null {
	const posted = [job.salary_min, job.salary_max].filter((v): v is number => v != null && v > 0);
	if (posted.length === 0) return null;
	const top = Math.max(...posted);

	const period = normalizeSalaryPeriod(job.salary_period);
	const currency = job.salary_currency?.trim().toUpperCase();
	if (!currency) return null;
	if (period !== 'hour' && period !== 'day' && period !== 'month' && period !== 'year') {
		return null;
	}

	const inEuros = convertCurrency(top, currency, 'EUR', rates);
	const [low, high] = PLAUSIBLE_EUR[period];
	if (inEuros == null || inEuros < low || inEuros > high) return null;

	const kind = postedPayKind(period, canonicalJobTypes(job.job_types));
	const context = jobContextFor(job);

	if (kind === 'employed' && (period === 'month' || period === 'year')) {
		const e = asks.employed;
		const ask = e && askForJob('employed', e, asks.adjustments, context);
		if (!e || !ask) return null;
		const offered = convertCurrency(grossPayPerYear(e, top, period), currency, ask.currency, rates);
		const wanted = grossPayPerYear(e, ask.amount, e.period);
		if (offered == null || wanted <= 0) return null;
		return { ratio: rounded(offered / wanted), ask: 'employed' };
	}

	if (kind === 'freelance' && period !== 'year') {
		const f = asks.freelance;
		const ask = f && askForJob('freelance', f, asks.adjustments, context);
		if (!f || !ask) return null;
		const offered = convertCurrency(top * unitsPerYear(f, period), currency, ask.currency, rates);
		const wanted = ask.amount * unitsPerYear(f, f.unit);
		if (offered == null || wanted <= 0) return null;
		return { ratio: rounded(offered / wanted), ask: 'freelance' };
	}

	return null;
}

/** How far below the ask a job may pay and still be shown, unless they say otherwise. */
export const DEFAULT_BELOW_ASK_TOLERANCE_PCT = 10;
export const MAX_BELOW_ASK_TOLERANCE_PCT = 50;

/** The lowest ratio still shown: the ask, less the tolerance they allow. */
export function payFloor(tolerancePct: number): number {
	const pct = Number.isFinite(tolerancePct) ? Math.round(tolerancePct) : 0;
	return 1 - Math.min(Math.max(pct, 0), MAX_BELOW_ASK_TOLERANCE_PCT) / 100;
}

export type PayVerdict = 'meets' | 'close' | 'below';

/** A stored ratio as what a card says about it. Null has nothing to say. */
export function payVerdict(
	ratio: number | null | undefined,
	tolerancePct: number
): PayVerdict | null {
	if (ratio == null) return null;
	if (ratio >= 1) return 'meets';
	return ratio >= payFloor(tolerancePct) ? 'close' : 'below';
}

export const PAY_VERDICT_LABELS: Record<PayVerdict, string> = {
	meets: 'Meets your ask',
	close: 'Close to your ask',
	below: 'Below your ask'
};

/** One sentence on what the badge is based on, for its tooltip. */
export function payVerdictDetail(ratio: number, ask: string | null): string {
	const against = ask === 'freelance' ? 'your freelance rate' : 'your salary ask';
	if (ratio >= 1) return `The most it pays is at or above ${against}.`;
	// At least 1%: a job a hair under the ask is still under it.
	const short = Math.max(1, Math.round((1 - ratio) * 100));
	return `The most it pays is ${short}% below ${against}.`;
}

export type PayBadge = { verdict: PayVerdict; detail: string };

/** What a job card says about pay, from a stored ratio, or null to say nothing. */
export function payBadge(
	ratio: number | null | undefined,
	ask: string | null | undefined,
	tolerancePct: number
): PayBadge | null {
	const verdict = payVerdict(ratio, tolerancePct);
	return verdict && ratio != null
		? { verdict, detail: payVerdictDetail(ratio, ask ?? null) }
		: null;
}
