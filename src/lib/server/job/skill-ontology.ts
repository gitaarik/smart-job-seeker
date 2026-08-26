/**
 * Typed, directional relations between skill concepts — the layer under the
 * matcher that knows React implies JavaScript and JavaScript does not imply
 * React.
 *
 * ## Why this exists at all
 *
 * `skill-embeddings.ts` expands a profile's skills with semantically-near
 * terms, and that is genuinely useful — measured on 40 labelled pairs it more
 * than doubles recall over normalize-exact. But cosine returns ONE number for
 * an unordered pair, so the same expansion that correctly matched
 * `Django → Python` also matched `Python → Django`. One symmetric number, both
 * directions, one of them wrong.
 *
 * No threshold repairs that. Lowering it to admit `React → JavaScript` (a false
 * negative today) drags in more `Python → Django` alongside, because the two
 * sit at the same distance. The relation being modelled is directional, so the
 * store has to be.
 *
 * Full measurement and design: planning/SKILL-ONTOLOGY.md (sjs-ops).
 *
 * ## What "upward" means
 *
 * A profile expands UP: you know the specific thing, they asked for the general
 * one. `React` reaches `JavaScript`; `JavaScript` reaches nothing downward. Any
 * traversal that walks `to_id → from_id` reintroduces the exact defect this
 * module was written to remove, which is why there is no such function here.
 *
 * ## What is deliberately absent
 *
 * `related` (Docker ↔ Kubernetes). It is symmetric, so admitting it to the
 * match path would put the false positives straight back. It has a place in gap
 * analysis — "one hop from what they asked for" — and that is a different
 * question from eligibility.
 */

import { sql, type SQL } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';
import { normalizeSkill } from '$lib/skills';

/**
 * Relations that license a match upward. Closed on purpose — this list IS the
 * ontology, and adding to it is a decision recorded in the plan, not a
 * convenience.
 *
 * `broader` is "is a kind of" (React → JavaScript framework). `requires` is
 * "cannot be used without" (Django → Python) — a different claim, since Django
 * is not a kind of Python, but it licenses the same inference: someone who has
 * used Django has necessarily used Python.
 */
export const MATCHING_RELATIONS = ['broader', 'requires'] as const;

/**
 * How far a profile skill may reach.
 *
 * Four hops is already generous for a real hierarchy (React → JS framework →
 * frontend → software engineering). A vocabulary that needs more than this is
 * wrong rather than deep, and an unbounded walk over a cycle someone approved
 * by mistake would not terminate.
 */
export const MAX_DEPTH = 4;

/**
 * A parameterised `IN (…)` list.
 *
 * NOT `= ANY(${array})`: drizzle interpolates a JS array as a placeholder list
 * rather than a Postgres array literal, so the operator sees a record and
 * Postgres rejects it — with or without a `::text[]` cast, which then fails as
 * "cannot cast type record". Each value gets its own placeholder instead, which
 * is both correct and still fully parameterised.
 */
function inList(values: string[]): SQL {
	return sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	);
}

export interface ConceptRef {
	id: number;
	slug: string;
	label: string;
}

/**
 * Resolve free-text skill names to concepts, by slug or by alias.
 *
 * Unresolved names are simply absent from the result. That is not an error: the
 * applicant types what they like and the vocabulary will never cover all of it,
 * so an unknown skill has to fall through to the layers that do not need it
 * rather than fail.
 */
export async function resolveConcepts(names: string[]): Promise<Map<string, ConceptRef>> {
	const out = new Map<string, ConceptRef>();
	const slugs = [...new Set(names.map(normalizeSkill).filter(Boolean))];
	if (slugs.length === 0) return out;

	const rows = await queryRawDirect<{ key: string; id: number; slug: string; label: string }>(sql`
		SELECT c.slug AS key, c.id, c.slug, c.label
		FROM skill_concepts c
		WHERE c.slug IN (${inList(slugs)})
		UNION
		SELECT a.alias AS key, c.id, c.slug, c.label
		FROM skill_aliases a
		JOIN skill_concepts c ON c.id = a.concept_id
		WHERE a.alias IN (${inList(slugs)}) AND a.approved_at IS NOT NULL
	`);

	for (const r of rows) out.set(r.key, { id: r.id, slug: r.slug, label: r.label });
	return out;
}

/**
 * Every concept reachable UPWARD from these skills, including the skills
 * themselves — the set a job's requirement may be satisfied by.
 *
 * Only APPROVED relations and aliases are traversed. An unapproved edge is a proposal, and
 * a wrong one is invisible and global: it would change matching for every
 * profile with nothing to surface it. Nothing unapproved may influence a match.
 *
 * Returns labels rather than slugs so callers can say *why* something matched.
 */
export async function expandUpward(
	skills: string[],
	maxDepth = MAX_DEPTH
): Promise<{ slug: string; label: string; depth: number }[]> {
	const slugs = [...new Set(skills.map(normalizeSkill).filter(Boolean))];
	if (slugs.length === 0) return [];

	// `UNION` rather than `UNION ALL`: it dedupes the working set each round, so
	// a diamond in the graph (two paths to one ancestor) cannot blow up, and a
	// cycle someone approved by mistake terminates instead of running until the
	// depth guard catches it.
	const rows = await queryRawDirect<{ slug: string; label: string; depth: number }>(sql`
		WITH RECURSIVE seed AS (
			SELECT c.id, 0 AS depth FROM skill_concepts c WHERE c.slug IN (${inList(slugs)})
			UNION
			SELECT c.id, 0 AS depth
			FROM skill_aliases a JOIN skill_concepts c ON c.id = a.concept_id
			WHERE a.alias IN (${inList(slugs)}) AND a.approved_at IS NOT NULL
		),
		up AS (
			SELECT id, depth FROM seed
			UNION
			SELECT r.to_id, up.depth + 1
			FROM up
			JOIN skill_relations r ON r.from_id = up.id
			WHERE r.approved_at IS NOT NULL
			  AND r.relation IN (${inList([...MATCHING_RELATIONS])})
			  AND up.depth < ${maxDepth}
		)
		SELECT c.slug, c.label, MIN(up.depth) AS depth
		FROM up JOIN skill_concepts c ON c.id = up.id
		GROUP BY c.slug, c.label
		ORDER BY depth, c.slug
	`);

	return rows.map((r) => ({ slug: r.slug, label: r.label, depth: Number(r.depth) }));
}

/**
 * Does knowing `have` license claiming `want`?
 *
 * The ordered question the whole module exists to answer. `have` and `want` are
 * NOT interchangeable — swapping them is a different claim, and on a correct
 * ontology exactly one of the two directions is true.
 */
export async function impliesSkill(have: string, want: string): Promise<boolean> {
	const target = normalizeSkill(want);
	if (!target) return false;
	if (normalizeSkill(have) === target) return true;

	const reachable = await expandUpward([have]);
	if (reachable.some((r) => r.slug === target)) return true;

	// The requirement may be written as an alias of a concept we reached
	// ("NodeJS" for the Node.js concept), so resolve it and compare identity.
	const resolved = await resolveConcepts([want]);
	const concept = resolved.get(target);
	return concept ? reachable.some((r) => r.slug === concept.slug) : false;
}
