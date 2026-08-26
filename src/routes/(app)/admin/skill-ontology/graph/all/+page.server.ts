/**
 * The whole approved graph, and — the reason to build it — everything not in it.
 *
 * ## What this answers that the focused view cannot
 *
 * The focused view answers "what does React reach?", and you have to already
 * suspect React to ask. This one answers "where is the ontology thin?", which
 * nobody can ask one concept at a time.
 *
 * On dev, 2026-08-26: **134 of 238 concepts have no approved relation at all.**
 * They are in the vocabulary and they match nothing but their own name. The
 * remaining 104 are joined by 103 edges into **16 disconnected islands**. There
 * is no single hierarchy here, and no page said so before this one.
 *
 * The counts move — curation runs against this table daily — so the page reads
 * them live and never repeats them from a comment. The shape is the durable
 * part: more than half the vocabulary reaches nothing, and what remains is many
 * small components rather than one. That sparsity is also what makes it
 * drawable at all; see `island-layout.ts`.
 *
 * ## Approved only, like everywhere else
 *
 * A picture of proposals would be a picture of something that does not affect
 * anyone's matches. What is drawn is what the matcher walks.
 */
import { fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { GRAPH_RELATIONS } from '$lib/server/job/skill-ontology';
import { refuseNewRelation } from '$lib/server/job/skill-relation-guards';
import type { Actions, PageServerLoad } from './$types';

export interface FullNode {
	id: number;
	slug: string;
	label: string;
}

export interface FullEdge {
	/** Needed to retire one: edges are addressed by row, not by pair. */
	id: number;
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
		SELECT id, from_id, to_id, relation FROM skill_relations
		WHERE approved_at IS NOT NULL AND relation IN (${inList(GRAPH_RELATIONS)})
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

function intFrom(form: FormData, key: string): number | null {
	const raw = form.get(key);
	if (typeof raw !== 'string') return null;
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}

export const actions: Actions = {
	/**
	 * Draw an edge between two concepts.
	 *
	 * ## Why this approves immediately
	 *
	 * The review queue exists to gate the *model's* proposals — the confidence
	 * floor does not work, and the two edges that had to be revoked scored 0.90
	 * and 0.95. It does not exist to gate an admin's own assertion. Someone who
	 * has dragged one concept onto another has made exactly the judgement the
	 * queue's Approve button records, and sending them to a second screen to press
	 * it again is ceremony, not review.
	 *
	 * The safety property is unchanged, it just lives elsewhere: an accidental
	 * drag cannot write anything, because the relation has to be picked before the
	 * write happens and there is no default. What this *does* refuse is in
	 * `refuseNewRelation` — the ways an edge can make the graph contradict itself,
	 * which is a different question from whether it is true.
	 *
	 * `ON CONFLICT ... DO UPDATE` is the useful case rather than a fallback —
	 * drawing an edge the proposer already suggested and nobody reviewed approves
	 * that exact row, instead of failing on the unique index.
	 */
	createRelation: async ({ request }) => {
		const form = await request.formData();
		const from = intFrom(form, 'from');
		const to = intFrom(form, 'to');
		const relation = String(form.get('relation') ?? '');
		if (from === null || to === null) return fail(400, { error: 'Invalid concept id.' });

		const refusal = await refuseNewRelation(from, to, relation);
		if (refusal) return fail(refusal.status, { error: refusal.error });

		await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, source, approved_at)
			VALUES (${from}, ${to}, ${relation}, 'manual', now())
			ON CONFLICT (from_id, to_id, relation) DO UPDATE SET approved_at = now()
		`);
		return { success: true };
	},

	/**
	 * Retire an edge.
	 *
	 * Unapproves, never deletes — the same write `rejectRelation` makes in the
	 * queue, for the reason recorded there: a deleted proposal comes straight back
	 * on the next run of `propose-skill-relations.ts` and review becomes
	 * Sisyphean. The row stays and reappears in the queue as pending, which is
	 * also what makes this reversible in one click.
	 */
	retireRelation: async ({ request }) => {
		const id = intFrom(await request.formData(), 'id');
		if (id === null) return fail(400, { error: 'Invalid id.' });
		await db.execute(sql`UPDATE skill_relations SET approved_at = NULL WHERE id = ${id}`);
		return { success: true };
	}
};
