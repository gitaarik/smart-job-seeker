/**
 * `job_matches.pay_ratio`: keeping it current, and filtering on it.
 *
 * The ratio is worked out in TypeScript by `payFit` and stored, rather than
 * worked out in SQL where it is read. The rules (which ask, region asks,
 * adjustments, holiday pay, billable hours, exchange rates, what counts as a
 * misread) would otherwise need a second copy in SQL, and two copies of a rule
 * drift: the two eligibility gates did, and scored the same job differently
 * depending on which queue it came through. Stored, the job list, Home and the
 * digest all filter on one column with one clause, `payFilterSql`, and the
 * paginated list keeps its counts.
 *
 * What it costs is keeping the column current. `refreshPayFit` is called when
 * a match is written (the matcher), when the asks change (Salary Prep, a
 * settings import), when a job's pay or type is edited, and for everything by
 * the worker every few hours, which also picks up new exchange rates and is
 * the backfill after a deploy. Any path that changes pay without calling it is
 * stale until then, never wrong in a way that hides more than it should for
 * longer than that.
 */

import { sql, type SQL } from 'drizzle-orm';
import { queryRawDirect, sqlJoin } from '$lib/server/db';
import { getFxRates } from './fx';
import { payFit, payFloor, type Asks } from '$lib/salary/pay-fit';
import { normalizeAdjustments, storedEmployed, storedFreelance } from '$lib/salary/settings';

/** Which matches to work out again. */
export type PayFitScope =
	{ profileId: number } | { jobId: number } | { matchIds: number[] } | { all: true };

type MatchPayRow = {
	id: number;
	profile_id: number;
	pay_ratio: number | null;
	pay_ask: string | null;
	salary_min: number | null;
	salary_max: number | null;
	salary_currency: string | null;
	salary_period: string | null;
	job_types: unknown;
	work_location: unknown;
	region: string | null;
};

type AskRow = {
	id: number;
	salary_employed: unknown;
	salary_freelance: unknown;
	salary_adjustments: unknown;
};

/** Rows per UPDATE: three parameters each, far under Postgres's 65,535. */
const UPDATE_CHUNK = 500;

function scopeClause(scope: PayFitScope): SQL {
	if ('profileId' in scope) return sql`jm.profile_id = ${scope.profileId}`;
	if ('jobId' in scope) return sql`jm.job_id = ${scope.jobId}`;
	if ('matchIds' in scope) return sql`jm.id IN (${sqlJoin(scope.matchIds)})`;
	return sql`TRUE`;
}

function asksFrom(row: AskRow): Asks {
	return {
		employed: storedEmployed(row.salary_employed),
		freelance: storedFreelance(row.salary_freelance),
		adjustments: normalizeAdjustments(row.salary_adjustments)
	};
}

/**
 * Work the ratio out again for the matches in `scope` and write the ones that
 * changed.
 *
 * Reads only rows that could hold a ratio, or still do: a job with pay on a
 * profile with an ask, or a row with a ratio to clear. A profile without asks
 * has nothing to compare, so a full run costs little where nobody uses Salary
 * Prep.
 */
export async function refreshPayFit(
	scope: PayFitScope
): Promise<{ checked: number; changed: number }> {
	if ('matchIds' in scope && scope.matchIds.length === 0) return { checked: 0, changed: 0 };

	const rows = await queryRawDirect<MatchPayRow>(sql`
		SELECT jm.id, jm.profile_id, jm.pay_ratio, jm.pay_ask,
			j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
			j.job_types, j.work_location, j.region
		FROM job_matches jm
		JOIN jobs j ON j.id = jm.job_id
		JOIN profiles p ON p.id = jm.profile_id
		WHERE ${scopeClause(scope)}
		AND (
			jm.pay_ratio IS NOT NULL
			OR jm.pay_ask IS NOT NULL
			OR (
				(j.salary_min IS NOT NULL OR j.salary_max IS NOT NULL)
				AND (p.salary_employed IS NOT NULL OR p.salary_freelance IS NOT NULL)
			)
		)
	`);
	if (rows.length === 0) return { checked: 0, changed: 0 };

	const profileIds = [...new Set(rows.map((r) => r.profile_id))];
	const [askRows, rates] = await Promise.all([
		queryRawDirect<AskRow>(sql`
			SELECT id, salary_employed, salary_freelance, salary_adjustments
			FROM profiles
			WHERE id IN (${sqlJoin(profileIds)})
		`),
		getFxRates()
	]);
	const asksByProfile = new Map(askRows.map((row) => [row.id, asksFrom(row)]));

	const changes: { id: number; ratio: number | null; ask: string | null }[] = [];
	for (const row of rows) {
		const asks = asksByProfile.get(row.profile_id);
		const fit = asks ? payFit(row, asks, rates) : null;
		const ratio = fit?.ratio ?? null;
		const ask = fit?.ask ?? null;
		if (row.pay_ratio === ratio && row.pay_ask === ask) continue;
		changes.push({ id: row.id, ratio, ask });
	}

	for (let i = 0; i < changes.length; i += UPDATE_CHUNK) {
		const values = sql.join(
			changes
				.slice(i, i + UPDATE_CHUNK)
				.map((c) => sql`(${c.id}::integer, ${c.ratio}::double precision, ${c.ask}::varchar)`),
			sql`, `
		);
		await queryRawDirect(sql`
			UPDATE job_matches AS jm
			SET pay_ratio = v.ratio, pay_ask = v.ask
			FROM (VALUES ${values}) AS v(id, ratio, ask)
			WHERE jm.id = v.id
		`);
	}

	return { checked: rows.length, changed: changes.length };
}

/**
 * `refreshPayFit` for a caller that must not fail because of it: a match that
 * was scored, an ask that was saved. The row keeps its old ratio, and the
 * worker's next full run puts it right.
 */
export async function refreshPayFitQuietly(scope: PayFitScope, context: string): Promise<void> {
	try {
		await refreshPayFit(scope);
	} catch (err) {
		console.error(
			`[pay-fit] refresh after ${context} failed:`,
			err instanceof Error ? err.message : String(err)
		);
	}
}

/**
 * How a list treats pay: `any` shows everything, `fit` leaves out what pays
 * below the ask (less the tolerance), `below` shows only that.
 */
export type PayFilterMode = 'any' | 'fit' | 'below';

const PAY_FILTER_MODES: readonly PayFilterMode[] = ['any', 'fit', 'below'];

export function parsePayFilterMode(raw: string | null | undefined): PayFilterMode | null {
	return PAY_FILTER_MODES.find((mode) => mode === raw) ?? null;
}

/** A profile's standing choice, from Match Config, and whether it has an ask to apply it with. */
export type PayFilterSetting = {
	hideBelowAsk: boolean;
	tolerancePct: number;
	hasAsks: boolean;
};

export async function readPayFilter(profileId: number): Promise<PayFilterSetting> {
	const [row] = await queryRawDirect<{
		hide_below_ask: boolean | null;
		below_ask_tolerance_pct: number | null;
		has_asks: boolean;
	}>(sql`
		SELECT mc.hide_below_ask, mc.below_ask_tolerance_pct,
			COALESCE(p.salary_employed->>'amount', p.salary_freelance->>'amount') IS NOT NULL
				AS has_asks
		FROM profiles p
		LEFT JOIN LATERAL (
			SELECT hide_below_ask, below_ask_tolerance_pct
			FROM match_config
			WHERE profile_id = p.id
			ORDER BY id
			LIMIT 1
		) mc ON TRUE
		WHERE p.id = ${profileId}
	`);
	return {
		hideBelowAsk: row?.hide_below_ask ?? false,
		tolerancePct: row?.below_ask_tolerance_pct ?? 10,
		hasAsks: row?.has_asks ?? false
	};
}

/** What a list shows: the mode its URL asks for, else the profile's standing choice. */
export function effectivePayMode(
	requested: PayFilterMode | null,
	setting: Pick<PayFilterSetting, 'hideBelowAsk'>
): PayFilterMode {
	return requested ?? (setting.hideBelowAsk ? 'fit' : 'any');
}

/**
 * The WHERE clause for a query over `job_matches`. A null ratio passes `fit`
 * and fails `below`: a job whose pay could not be read is never hidden for it.
 * `ratio` names the column as the query spells it.
 */
export function payFilterSql(
	mode: PayFilterMode,
	tolerancePct: number,
	ratio: SQL = sql`jm.pay_ratio`
): SQL {
	if (mode === 'any') return sql`TRUE`;
	const floor = payFloor(tolerancePct);
	return mode === 'fit'
		? sql`(${ratio} IS NULL OR ${ratio} >= ${floor})`
		: sql`${ratio} < ${floor}`;
}

/**
 * The same clause for a query over `jobs` with no match row joined: a job is
 * below the ask when this profile's match says so, and a job it never matched
 * has no ratio.
 */
export function payFilterJobSql(
	mode: PayFilterMode,
	tolerancePct: number,
	profileId: number,
	jobId: SQL = sql`j.id`
): SQL {
	if (mode === 'any') return sql`TRUE`;
	const below = sql`EXISTS (
		SELECT 1 FROM job_matches pay_jm
		WHERE pay_jm.job_id = ${jobId}
		AND pay_jm.profile_id = ${profileId}
		AND pay_jm.pay_ratio < ${payFloor(tolerancePct)}
	)`;
	return mode === 'fit' ? sql`NOT ${below}` : below;
}

/** The tolerances Match Config offers, in percent below the ask. */
export const BELOW_ASK_TOLERANCE_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

/**
 * How many of this profile's matches each tolerance would leave out, for the
 * setting's own page: a filter that says what it hides is one people keep on.
 * Matches scored zero are not counted, since no list shows them as matches.
 */
export async function countBelowAsk(
	profileId: number,
	tolerances: readonly number[] = BELOW_ASK_TOLERANCE_OPTIONS
): Promise<{ compared: number; below: Record<number, number> }> {
	const counts = sql.join(
		tolerances.map(
			(pct, i) => sql`COUNT(*) FILTER (WHERE pay_ratio < ${payFloor(pct)}) AS ${sql.raw(`t${i}`)}`
		),
		sql`, `
	);
	const [row] = await queryRawDirect<Record<string, string | number>>(sql`
		SELECT COUNT(*) FILTER (WHERE pay_ratio IS NOT NULL) AS compared, ${counts}
		FROM job_matches
		WHERE profile_id = ${profileId} AND score > 0
	`);
	return {
		compared: Number(row?.compared ?? 0),
		below: Object.fromEntries(tolerances.map((pct, i) => [pct, Number(row?.[`t${i}`] ?? 0)]))
	};
}
