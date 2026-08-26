/**
 * The edges a person is not allowed to draw.
 *
 * Split out of the graph page's action so it can be exercised by
 * `scripts/check-skill-ontology.ts` against a real database. Every one of these
 * refusals is about the graph contradicting *itself* — none of them is a
 * judgement about whether a relation is true, which is what review is for.
 *
 * `approveRelation` in the review queue does NOT run these yet. Approving a
 * pending edge can still close a loop, and it is the same defect arriving
 * through the other door; wiring it up is a one-line change here away.
 */
import { sql } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';
import { expandUpward, GRAPH_RELATIONS, MATCHING_RELATIONS } from './skill-ontology';

/** How far to look for a loop. Deliberately far past `MAX_DEPTH`. */
const LOOP_SEARCH_DEPTH = 32;

export interface RelationRefusal {
	/** HTTP status the caller should fail with. */
	status: number;
	error: string;
}

/**
 * Why an edge may not be drawn, or `null` if it may.
 *
 * Ordered cheapest-first: the two shape checks need no query, the clash check
 * needs one index lookup, and only then does the loop check walk the graph.
 */
export async function refuseNewRelation(
	from: number,
	to: number,
	relation: string
): Promise<RelationRefusal | null> {
	if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
		return { status: 400, error: 'Invalid concept id.' };
	}
	if (from === to) return { status: 400, error: 'A concept cannot imply itself.' };
	if (!(GRAPH_RELATIONS as readonly string[]).includes(relation)) {
		return { status: 400, error: `Unknown relation “${relation}”.` };
	}

	const ends = await queryRawDirect<{ id: number; slug: string; label: string }>(sql`
		SELECT id, slug, label FROM skill_concepts WHERE id IN (${from}, ${to})
	`);
	const a = ends.find((c) => c.id === from);
	const b = ends.find((c) => c.id === to);
	if (!a || !b) return { status: 404, error: 'Concept not found.' };

	// The queue's supersede rule, enforced where the edge is made rather than
	// reported after the fact: an approved edge between this pair in EITHER
	// direction means the question is already answered, and a second one is a
	// duplicate or — worse, because nothing would say so — a contradiction.
	const clash = await queryRawDirect<{ relation: string; reversed: boolean }>(sql`
		SELECT relation, (from_id = ${to}) AS reversed
		FROM skill_relations
		WHERE approved_at IS NOT NULL
		  AND ((from_id = ${from} AND to_id = ${to}) OR (from_id = ${to} AND to_id = ${from}))
		LIMIT 1
	`);
	if (clash.length > 0) {
		const c = clash[0];
		return {
			status: 409,
			error: c.reversed
				? `“${b.label}” ${c.relation} “${a.label}” is already approved — the other way round.`
				: `“${a.label}” ${c.relation} “${b.label}” is already approved.`
		};
	}

	// A loop makes each of its members imply the others, and it is the one defect
	// the traversal survives without complaining: `expandUpward` uses UNION, so a
	// cycle terminates quietly rather than surfacing anywhere. Checked with that
	// traversal itself, so the guard cannot drift from the thing it guards.
	//
	// Only for relations the matcher walks. `inDomain` is drawn and never
	// traversed, so a loop through it costs nothing and refusing one would block
	// a legitimate second domain for a category.
	if ((MATCHING_RELATIONS as readonly string[]).includes(relation)) {
		const reach = await expandUpward([b.label], LOOP_SEARCH_DEPTH);
		if (reach.some((c) => c.slug === a.slug)) {
			return {
				status: 409,
				error: `“${b.label}” already reaches “${a.label}”, so this would close a loop.`
			};
		}
	}

	return null;
}
