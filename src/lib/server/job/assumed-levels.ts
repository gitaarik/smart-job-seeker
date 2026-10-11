/**
 * Which of a job's asked skills an applicant can be taken to have without a
 * line proving it: Git, for a senior developer.
 *
 * A concept may carry the level from which it is taken for granted and the line
 * of work that holds in (`skill_concepts.assumed_from` and `assumed_for`,
 * reviewed for every concept on 2026-10-11; planning/SKILL-ONTOLOGY.md
 * § Assumed levels). This decides whether one applicant is at or above that
 * level and in that line of work. Below the level, or in another line of work,
 * the skill needs evidence like any other: a junior's Git line, or a
 * marketer's, says something a senior developer's does not.
 *
 * It started with application 92, which required "Version Control". The
 * tailoring keeps the last printed line naming each required skill, the only
 * one left was LitState's "open-sourced on GitHub", and it cut the Smart Job
 * Seeker project to keep it.
 */

export const LEVELS = ['junior', 'medior', 'senior'] as const;
export type Level = (typeof LEVELS)[number];

/**
 * How an applicant is known to be in a line of work: at least MIN_HELD of the
 * skills they hold reach one of these concepts in the graph.
 *
 * A line of work missing here applies to no one. That is where "office workers"
 * and "sales and support roles" are: no concept in the graph says who does that
 * work, and "everyone" would be wrong, because the office tools that review
 * gave them are central to analysts and finance.
 */
export const LINES_OF_WORK: Record<string, readonly string[] | 'everyone'> = {
	everyone: 'everyone',
	'software developers': ['softwaredevelopment'],
	'web developers': ['webdevelopment', 'frontenddevelopment'],
	'data professionals': ['dataanalysis', 'datascience'],
	marketers: ['marketing']
};

/**
 * Held skills in a line of work before the applicant counts as doing it. One
 * Python skill on a marketer's profile does not make them a developer; three
 * skills under Software development is a developer's profile at its thinnest.
 */
export const MIN_HELD = 3;

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function toTime(value: unknown): number | null {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
	if (typeof value !== 'string' || !value) return null;
	const t = Date.parse(value);
	return Number.isNaN(t) ? null : t;
}

/**
 * The applicant's level from their roles: years of work as the union of the
 * roles' date ranges, so two roles at once count once and a gap counts not at
 * all. Under 2 years junior, under 5 medior, from 5 senior. Null without a
 * dated role, which takes nothing for granted.
 */
export function careerLevel(
	roles: { start_date?: unknown; end_date?: unknown }[],
	now: Date = new Date()
): Level | null {
	const spans = roles
		.map((r) => [toTime(r.start_date), toTime(r.end_date) ?? now.getTime()] as const)
		.filter((s): s is readonly [number, number] => s[0] !== null && s[1] > s[0])
		.sort((a, b) => a[0] - b[0]);
	if (spans.length === 0) return null;

	let total = 0;
	let [start, end] = spans[0];
	for (const [s, e] of spans.slice(1)) {
		if (s > end) {
			total += end - start;
			[start, end] = [s, e];
		} else if (e > end) {
			end = e;
		}
	}
	total += end - start;

	const years = total / YEAR_MS;
	return years < 2 ? 'junior' : years < 5 ? 'medior' : 'senior';
}

/**
 * The concepts, of those given, this applicant is taken to have.
 *
 * `levels` is what the graph says about the asked concepts (assumedLevels in
 * skill-ontology.ts); `heldIn` counts the applicant's held skills that reach
 * any of the given concepts. A level or a line of work this code does not know
 * takes nothing for granted.
 */
export function takenForGranted(
	levels: Map<string, { from: string; for: string | null }>,
	level: Level | null,
	heldIn: (concepts: readonly string[]) => number
): Set<string> {
	const out = new Set<string>();
	if (!level) return out;
	const rank = LEVELS.indexOf(level);
	for (const [slug, assumed] of levels) {
		const from = LEVELS.indexOf(assumed.from as Level);
		if (from < 0 || rank < from) continue;
		const line = assumed.for ? LINES_OF_WORK[assumed.for] : undefined;
		if (!line) continue;
		if (line === 'everyone' || heldIn(line) >= MIN_HELD) out.add(slug);
	}
	return out;
}
