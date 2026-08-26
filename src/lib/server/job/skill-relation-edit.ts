/**
 * The two writes an admin can make to the graph by hand, shared by every page
 * that draws it.
 *
 * Split out when the focused view gained editing. Both graph views make exactly
 * the same two writes and must keep making the same ones — an edge drawn on the
 * whole-graph page and an edge drawn on a concept's neighbourhood are the same
 * assertion, and the reasons below are the kind that get silently reinterpreted
 * when the code is copied rather than called.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { refuseNewRelation, type RelationRefusal } from './skill-relation-guards';

export type EditResult = { ok: true } | { ok: false; refusal: RelationRefusal };

/** Parse a form field that must be a positive integer id. */
export function intFrom(form: FormData, key: string): number | null {
	const raw = form.get(key);
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Draw an edge between two concepts, approved immediately.
 *
 * ## Why this does not go through the queue
 *
 * The review queue exists to gate the *model's* proposals — the confidence floor
 * does not work on this vocabulary, and every edge that had to be revoked scored
 * 0.90 or above. It does not exist to gate an admin's own assertion. Someone who
 * has just dragged one concept onto another and chosen a relation has made
 * exactly the judgement the queue's Approve button records, and sending them to
 * a second screen to press it again is ceremony rather than review.
 *
 * The safety property is unchanged, it just lives elsewhere: an accidental drag
 * writes nothing, because a relation must be picked first and there is no
 * default. What is refused is in `refuseNewRelation` — the ways an edge makes
 * the graph contradict itself, which is a different question from whether it is
 * true.
 *
 * `ON CONFLICT … DO UPDATE` is the useful case rather than a fallback: drawing
 * an edge the proposer already suggested and nobody reviewed approves that exact
 * row, instead of failing on the unique index.
 */
export async function createRelation(form: FormData): Promise<EditResult> {
	const from = intFrom(form, 'from');
	const to = intFrom(form, 'to');
	const relation = String(form.get('relation') ?? '');
	if (from === null || to === null) {
		return { ok: false, refusal: { status: 400, error: 'Invalid concept id.' } };
	}

	const refusal = await refuseNewRelation(from, to, relation);
	if (refusal) return { ok: false, refusal };

	await db.execute(sql`
		INSERT INTO skill_relations (from_id, to_id, relation, source, approved_at)
		VALUES (${from}, ${to}, ${relation}, 'manual', now())
		ON CONFLICT (from_id, to_id, relation) DO UPDATE SET approved_at = now()
	`);
	return { ok: true };
}

/**
 * Retire an edge.
 *
 * Unapproves, never deletes — the same write `rejectRelation` makes in the
 * queue, for the reason recorded there: a deleted proposal comes straight back
 * on the next run of `propose-skill-relations.ts` and review becomes Sisyphean.
 * The row stays, reappears in the queue as pending, and that is also what makes
 * this reversible in one click.
 */
export async function retireRelation(form: FormData): Promise<EditResult> {
	const id = intFrom(form, 'id');
	if (id === null) return { ok: false, refusal: { status: 400, error: 'Invalid id.' } };
	await db.execute(sql`UPDATE skill_relations SET approved_at = NULL WHERE id = ${id}`);
	return { ok: true };
}
