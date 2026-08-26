/**
 * The whole approved graph, and — the reason to build it — everything not in it.
 *
 * ## What this answers that the focused view cannot
 *
 * The focused view answers "what does React reach?", and you have to already
 * suspect React to ask. This one answers "where is the ontology thin?", which
 * nobody can ask one concept at a time.
 *
 * Measured on dev the day it was written: **131 of 247 concepts have no
 * approved relation at all.** They are in the vocabulary and they match nothing
 * but their own name. The remaining 116 are joined by 117 edges into **18
 * disconnected islands** — the largest 29 and 26 nodes, everything else 8 or
 * fewer. There is no single hierarchy here, and no page said so before this one.
 *
 * That sparsity is also what makes it drawable: about one edge per node, a DAG
 * four hops deep, maximum in-degree 5. See `island-layout.ts`.
 *
 * ## Approved only, like everywhere else
 *
 * A picture of proposals would be a picture of something that does not affect
 * anyone's matches. What is drawn is what the matcher walks.
 */
import { sql } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';
import { MATCHING_RELATIONS } from '$lib/server/job/skill-ontology';
import type { PageServerLoad } from './$types';

export interface FullNode {
	id: number;
	slug: string;
	label: string;
}

export interface FullEdge {
	from_id: number;
	to_id: number;
	relation: string;
}

function inList(values: readonly string[]) {
	return sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	);
}

export const load: PageServerLoad = async () => {
	const relations = sql`
		SELECT from_id, to_id, relation FROM skill_relations
		WHERE approved_at IS NOT NULL AND relation IN (${inList(MATCHING_RELATIONS)})
	`;

	const [edges, nodes, isolated] = await Promise.all([
		queryRawDirect<FullEdge>(relations),
		queryRawDirect<FullNode>(sql`
			SELECT c.id, c.slug, c.label
			FROM skill_concepts c
			WHERE c.id IN (SELECT from_id FROM (${relations}) e UNION SELECT to_id FROM (${relations}) e2)
			ORDER BY c.label
		`),
		// Not an error state and not padding: this is the finding. A concept with
		// no approved edge is reachable only by its own name, so it behaves
		// exactly as it did before the ontology existed.
		queryRawDirect<FullNode>(sql`
			SELECT c.id, c.slug, c.label
			FROM skill_concepts c
			WHERE c.id NOT IN (SELECT from_id FROM (${relations}) e UNION SELECT to_id FROM (${relations}) e2)
			ORDER BY c.label
		`)
	]);

	return { nodes, edges, isolated };
};
