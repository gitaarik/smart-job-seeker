/**
 * A focused view of one concept's neighbourhood in the skill graph.
 *
 * ## Why not the whole graph
 *
 * Because 244 nodes is a hairball, and a hairball answers no question. The
 * questions worth asking here are local — *what does React reach?*, *why did
 * this job match?*, *what feeds into "Backend development"?* — and each is one
 * concept's ancestry plus its children.
 *
 * The shape allows it. Measured on the live vocabulary, the maximum out-degree
 * is **3** and the maximum in-degree is **5**, over a hierarchy bounded at four
 * hops. A neighbourhood is therefore small enough to lay out exactly rather
 * than approximately, which is why there is no force simulation and no graph
 * library: depth comes out of the recursive query, and depth IS the layout.
 *
 * That determinism is a feature beyond tidiness — the same concept renders
 * identically every time, so a screenshot is reproducible.
 *
 * ## What is drawn
 *
 * Ancestors follow the edges the matcher follows: upward, approved only, so
 * this shows exactly what a profile listing that skill would expand to.
 * Descendants are drawn one level only — they answer "who else lands here" and
 * fan out fastest.
 */
import { sql } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';
import { normalizeSkill } from '$lib/skills';
import { MATCHING_RELATIONS, MAX_DEPTH } from '$lib/server/job/skill-ontology';
import type { PageServerLoad } from './$types';

export interface GraphNode {
	id: number;
	slug: string;
	label: string;
	/** 0 is the focused concept; positive is an ancestor, -1 a direct child. */
	depth: number;
}

export interface GraphEdge {
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

export const load: PageServerLoad = async ({ url }) => {
	const concepts = await queryRawDirect<{ id: number; slug: string; label: string }>(sql`
		SELECT id, slug, label FROM skill_concepts ORDER BY label
	`);

	const wanted = normalizeSkill(url.searchParams.get('concept') ?? '');
	const root = concepts.find((c) => c.slug === wanted) ?? null;
	if (!root) return { concepts, root: null, nodes: [], edges: [] };

	// Upward: the same traversal the matcher runs, so what is drawn is what
	// would actually match. MIN(depth) because a diamond reaches one ancestor by
	// two paths and the shorter is the one worth drawing it at.
	const ancestors = await queryRawDirect<GraphNode>(sql`
		WITH RECURSIVE up AS (
			SELECT id, 0 AS depth FROM skill_concepts WHERE id = ${root.id}
			UNION
			SELECT r.to_id, up.depth + 1
			FROM up
			JOIN skill_relations r ON r.from_id = up.id
			WHERE r.approved_at IS NOT NULL
			  AND r.relation IN (${inList(MATCHING_RELATIONS)})
			  AND up.depth < ${MAX_DEPTH}
		)
		SELECT c.id, c.slug, c.label, MIN(up.depth)::int AS depth
		FROM up JOIN skill_concepts c ON c.id = up.id
		GROUP BY c.id, c.slug, c.label
	`);

	// Downward, one level: "who else arrives here". Fans out fastest, and past
	// one hop it stops being a neighbourhood and starts being the whole graph.
	const children = await queryRawDirect<GraphNode>(sql`
		SELECT c.id, c.slug, c.label, -1 AS depth
		FROM skill_relations r
		JOIN skill_concepts c ON c.id = r.from_id
		WHERE r.to_id = ${root.id} AND r.approved_at IS NOT NULL
	`);

	const nodes = [...ancestors, ...children.filter((c) => !ancestors.some((a) => a.id === c.id))];
	const ids = nodes.map((n) => n.id);

	const edges = ids.length
		? await queryRawDirect<GraphEdge>(sql`
				SELECT r.from_id, r.to_id, r.relation
				FROM skill_relations r
				WHERE r.approved_at IS NOT NULL
				  AND r.from_id IN (${sql.join(
						ids.map((i) => sql`${i}`),
						sql`, `
					)})
				  AND r.to_id IN (${sql.join(
						ids.map((i) => sql`${i}`),
						sql`, `
					)})
			`)
		: [];

	return { concepts, root, nodes, edges };
};
