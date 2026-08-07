/**
 * Generic relevance retrieval over profile content units — the unit-type-
 * agnostic sibling of retrieval.ts's project↔job ranking, and the retrieval half
 * of the Feature 5 scale foundation.
 *
 * A "unit" is any rankable piece of the applicant's profile (a STAR story, a
 * cheat sheet, an application text, …). Given a free-form query, this returns the
 * top-K most relevant, formatted as a self-contained prompt block. Two rankers,
 * one interface, matching the project layer:
 *  - SEMANTIC (embedding cosine) via content-embeddings.ts when embeddings are
 *    configured;
 *  - DETERMINISTIC (bounded token overlap) otherwise, so retrieval always works.
 *
 * The deterministic ranker scores by DISTINCT shared tokens, capped by the query
 * size rather than the unit size — so a long unit cannot dominate every query
 * the way an unnormalized keyword count can (the failure mode observed in the
 * project ranker). See planning/SEMANTIC-MATCHING-AND-RAG.md § Feature 5.
 */

import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { applications, project_stories } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { type ContentUnit, poolKey, semanticScoreUnits } from './content-embeddings';

/** A rankable profile content unit. */
export interface RankableUnit {
	/** Unit type namespace, e.g. "story". Part of the embedding key. */
	type: string;
	id: number;
	title: string;
	/** Optional subtitle shown in the citation head, e.g. "leadership story". */
	context: string;
	/** Discrete terms (categories, tags, tech) for skill/keyword matching. */
	keywords: string[];
	/** Prose body, for deterministic token overlap. */
	text: string;
	/** The blurb handed to the writer to draw on. */
	citation: string;
	/** What gets embedded for semantic ranking (title + context + body). */
	embedText: string;
}

/** What a unit is ranked against — a topic, a job, a competency, a question. */
export interface UnitQuery {
	text: string;
	skills?: string[];
}

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);

const STOPWORDS = new Set([
	'the',
	'and',
	'for',
	'with',
	'that',
	'this',
	'from',
	'have',
	'has',
	'was',
	'were',
	'are',
	'you',
	'your',
	'our',
	'their',
	'its',
	'into',
	'about',
	'over',
	'then',
	'than',
	'them',
	'they',
	'when',
	'what',
	'which',
	'who',
	'how',
	'why',
	'not',
	'but',
	'all',
	'any',
	'can',
	'will',
	'would',
	'should',
	'could',
	'been',
	'using',
	'used',
	'use',
	'via',
	'per',
	'out',
	'off',
	'some',
	'more',
	'most'
]);

/** Significant lowercase tokens (len ≥ 3, non-stopword); keeps + # . for tech. */
function tokens(s: string): Set<string> {
	const out = new Set<string>();
	for (const raw of s
		.toLowerCase()
		.replace(/[^a-z0-9+#. ]/g, ' ')
		.split(/\s+/)) {
		const t = raw.replace(/^\.+|\.+$/g, '');
		if (t.length >= 3 && !STOPWORDS.has(t)) out.add(t);
	}
	return out;
}

function intersectSize(a: Set<string>, b: Set<string>): number {
	let n = 0;
	for (const x of a) if (b.has(x)) n++;
	return n;
}

/**
 * Deterministic relevance of a unit to a query. A title-token hit weighs double a
 * body-token hit, and an explicit query-skill matching a unit keyword weighs
 * most. The score is bounded by the QUERY's token count (distinct overlaps), not
 * the unit's length, so a large unit cannot out-score a topical one everywhere.
 * Pure — unit-testable.
 */
export function scoreUnitAgainstQuery(
	unit: { title?: string; keywords: string[]; text?: string },
	query: UnitQuery
): number {
	const queryTokens = tokens([query.text, ...(query.skills ?? [])].filter(Boolean).join(' '));
	if (queryTokens.size === 0) return 0;

	const titleTokens = tokens(unit.title ?? '');
	const bodyTokens = tokens([unit.text ?? '', unit.keywords.join(' ')].join(' '));
	// Don't double-count a token present in both title and body.
	for (const t of titleTokens) bodyTokens.delete(t);

	let score = intersectSize(queryTokens, titleTokens) * 2 + intersectSize(queryTokens, bodyTokens);

	// Explicit skill ↔ keyword match: strongest signal.
	const kw = unit.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
	for (const raw of query.skills ?? []) {
		const s = raw.toLowerCase().trim();
		if (s.length < 2) continue;
		if (
			kw.some(
				(k) => k === s || (s.length >= 3 && k.includes(s)) || (k.length >= 3 && s.includes(k))
			)
		) {
			score += 2;
		}
	}
	return score;
}

/** Rank units deterministically; drop zero-score, take top K. Pure. */
export function rankUnits(
	units: RankableUnit[],
	query: UnitQuery,
	k = 3
): (RankableUnit & { score: number })[] {
	return units
		.map((u) => ({ ...u, score: scoreUnitAgainstQuery(u, query) }))
		.filter((u) => u.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, k);
}

/** Rank units by their semantic cosine scores, applying the relevance floor. */
function rankUnitsBySemantic(
	units: RankableUnit[],
	scores: Map<string, number>,
	k: number
): (RankableUnit & { score: number })[] {
	// Reuse the project relevance floor as the baseline; genuinely different unit
	// types may want their own tuning once embeddings run against real data.
	const floor = config.embeddingProjectThreshold;
	return units
		.map((u) => ({ ...u, score: scores.get(poolKey(u.type, u.id)) ?? 0 }))
		.filter((u) => u.score >= floor)
		.sort((a, b) => b.score - a.score)
		.slice(0, k);
}

/**
 * Rank units against a query, preferring semantic (embedding) scoring and
 * falling back to deterministic overlap when embeddings are off or the provider
 * fails. Same output shape either way.
 */
export async function relevantUnits(
	profileId: number,
	query: UnitQuery,
	units: RankableUnit[],
	k = 3
): Promise<(RankableUnit & { score: number })[]> {
	if (units.length === 0) return [];
	const contentUnits: ContentUnit[] = units.map((u) => ({
		unitType: u.type,
		unitId: u.id,
		subId: 0,
		embedText: u.embedText
	}));
	const queryText = [query.text, ...(query.skills ?? [])].filter(Boolean).join('\n');
	const scores = await semanticScoreUnits(profileId, contentUnits, queryText);
	if (scores) return rankUnitsBySemantic(units, scores, k);
	return rankUnits(units, query, k);
}

/**
 * Format ranked units into a self-contained prompt block with a caller-supplied
 * header + intro (so different sources read appropriately). Returns "" when
 * there are no matches.
 */
export function formatUnitCitations(
	ranked: RankableUnit[],
	opts: { header: string; intro: string }
): string {
	if (ranked.length === 0) return '';
	const items = ranked.map((u, i) => {
		const head = u.context ? `${u.title} (${u.context})` : u.title;
		return `${i + 1}. ${head}\n${u.citation}`;
	});
	return `## ${opts.header}\n\n${opts.intro}\n\n` + items.join('\n\n');
}

// ---------------------------------------------------------------------------
// Source: STAR stories (project_stories). The first unit type on the generic
// layer; adding cheat sheets / application texts is another loader like this.
// ---------------------------------------------------------------------------

/** The minimal story shape the loader needs — kept narrow so it's testable. */
export interface StoryRow {
	id: number;
	title: string | null;
	category: string | null;
	situation: string | null;
	task: string | null;
	action: string | null;
	result: string | null;
	reflection: string | null;
}

// Titles the "Add story" entry point seeds a draft with — a story still carrying
// one isn't ready to be cited as a reference, even if it has body text.
const PLACEHOLDER_STORY_TITLES = new Set(['new story', 'untitled', 'untitled story']);

/**
 * Build a rankable unit from a story row, or null to skip it: unnamed /
 * placeholder-titled drafts and stories with no STAR body carry no citable
 * value. Pure — unit-testable.
 */
export function buildStoryUnit(s: StoryRow): RankableUnit | null {
	const title = s.title?.trim();
	const star = [
		s.situation && `Situation: ${s.situation.trim()}`,
		s.task && `Task: ${s.task.trim()}`,
		s.action && `Action: ${s.action.trim()}`,
		s.result && `Result: ${s.result.trim()}`,
		s.reflection && `Reflection: ${s.reflection.trim()}`
	]
		.filter(Boolean)
		.join(' ');
	if (!title || !star.trim()) return null;
	if (PLACEHOLDER_STORY_TITLES.has(title.toLowerCase())) return null;

	const category = s.category?.trim() ?? '';
	return {
		type: 'story',
		id: s.id,
		title,
		context: category ? `${category.replace(/_/g, ' ')} story` : 'STAR story',
		keywords: category ? [category] : [],
		text: star,
		citation: clip(star, 800),
		embedText: clip([title, category, star].filter(Boolean).join('\n'), 8000)
	};
}

/**
 * Drop units that share a normalized title with an earlier one, keeping the
 * first. Within a single unit type a repeated title means a duplicate or a
 * near-identical draft/variant (observed in real data: the same story entered
 * twice) — citing both wastes a slot and reads as an error. Pure — unit-testable.
 */
export function dedupeUnits(units: RankableUnit[]): RankableUnit[] {
	const seen = new Set<string>();
	const out: RankableUnit[] = [];
	for (const u of units) {
		const sig = u.title.toLowerCase().replace(/\s+/g, ' ').trim();
		if (sig && seen.has(sig)) continue;
		if (sig) seen.add(sig);
		out.push(u);
	}
	return out;
}

/** Load a profile's citable STAR stories as rankable units. */
async function loadStoryUnits(profileId: number): Promise<RankableUnit[]> {
	const rows = await db.query.project_stories.findMany({
		where: eq(project_stories.profile_id, profileId),
		columns: {
			id: true,
			title: true,
			category: true,
			situation: true,
			task: true,
			action: true,
			result: true,
			reflection: true
		}
	});
	const units = rows.map(buildStoryUnit).filter((u): u is RankableUnit => u !== null);
	return dedupeUnits(units);
}

/**
 * One-call convenience: the applicant's top-K STAR stories relevant to `query`,
 * as a ready-to-interpolate block ("" if none). Mirrors relevantProjectsText.
 */
export async function relevantStoriesText(
	profileId: number,
	query: UnitQuery,
	k = 3
): Promise<string> {
	const units = await loadStoryUnits(profileId);
	const ranked = await relevantUnits(profileId, query, units, k);
	return formatUnitCitations(ranked, {
		header: 'Relevant interview stories the applicant has prepared',
		intro:
			"These are the applicant's OWN prepared STAR stories (situation / task / " +
			'action / result). Draw on the ones that fit this topic; ground every ' +
			'claim only in the notes here, do not invent.'
	});
}

// ---------------------------------------------------------------------------
// Source: past application texts (cover letters + application answers). A
// job-tied, multi-table source — proof the generic layer handles more than
// profile-scoped units. The applicant's own writing about their experience,
// useful as a voice/phrasing reference.
// ---------------------------------------------------------------------------

/** Build a rankable unit from a free-text application artifact. */
function buildTextUnit(
	type: string,
	id: number,
	title: string,
	context: string,
	text: string
): RankableUnit {
	return {
		type,
		id,
		title,
		context,
		keywords: [],
		text,
		citation: clip(text, 800),
		embedText: clip([title, text].filter(Boolean).join('\n'), 8000)
	};
}

/**
 * Load a profile's past application writing as rankable units: cover letters and
 * answered application questions across all the profile's applications, each
 * tagged with the role it was written for. The job-tied cheat-sheet letter type
 * is excluded — that's interview prep, not application writing (see the
 * two-cheat-sheet distinction). Titles are unique per unit so title-dedup is
 * safe (an answer's title is its question).
 */
async function loadApplicationTextUnits(
	profileId: number,
	excludeApplicationId?: number
): Promise<RankableUnit[]> {
	const apps = await db.query.applications.findMany({
		where: eq(applications.profile_id, profileId),
		columns: { id: true },
		with: {
			job: { columns: { title: true, company: true } },
			application_letters: {
				columns: { id: true, letter_type: true, content: true }
			},
			application_questions: {
				columns: { id: true, question: true, answer: true }
			}
		}
	});

	const units: RankableUnit[] = [];
	for (const app of apps) {
		// Skip the application being written for, so a cover letter doesn't retrieve
		// itself (or its siblings) as the applicant's past writing.
		if (excludeApplicationId && app.id === excludeApplicationId) continue;
		const role = [app.job?.title, app.job?.company]
			.map((s) => s?.trim())
			.filter(Boolean)
			.join(' — ');

		for (const l of app.application_letters ?? []) {
			const content = l.content?.trim();
			if (!content || l.letter_type === 'cheat_sheet') continue;
			units.push(
				buildTextUnit(
					'app_letter',
					l.id,
					role ? `Cover letter — ${role}` : 'Cover letter',
					role ? `application for ${role}` : 'past cover letter',
					content
				)
			);
		}

		for (const q of app.application_questions ?? []) {
			const answer = q.answer?.trim();
			const question = q.question?.trim();
			if (!answer || !question) continue;
			units.push(
				buildTextUnit(
					'app_answer',
					q.id,
					clip(question, 90), // the question itself is a naturally-unique title
					role ? `application answer — ${role}` : 'application answer',
					`Q: ${question}\nA: ${answer}`
				)
			);
		}
	}
	return dedupeUnits(units);
}

/**
 * One-call convenience: the applicant's top-K past application texts relevant to
 * `query`, ready to interpolate ("" if none). The intro frames them as a
 * voice/phrasing reference, NOT claims to copy across jobs.
 */
export async function relevantApplicationTextsText(
	profileId: number,
	query: UnitQuery,
	k = 3,
	excludeApplicationId?: number
): Promise<string> {
	const units = await loadApplicationTextUnits(profileId, excludeApplicationId);
	const ranked = await relevantUnits(profileId, query, units, k);
	return formatUnitCitations(ranked, {
		header: "The applicant's own past application writing",
		intro:
			'Excerpts the applicant previously wrote for job applications (cover ' +
			'letters, application answers). Use them as a reference for how they ' +
			'describe their experience in their OWN voice — draw on relevant phrasing ' +
			'and facts, but do NOT copy claims tied to a different job.'
	});
}
