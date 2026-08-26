/**
 * Review queue for the skill ontology.
 *
 * ## Why this is an admin page and not a profile one
 *
 * The vocabulary is SHARED. One approval changes matching for every profile in
 * the instance, so it is not an applicant's data to edit — a single wrong
 * `React → Vue` would degrade everyone's results silently. The rest of the
 * ontology follows the same split (see `skill_concepts` in schema.ts): concepts
 * and relations are shared, `tech_skills.concept_id` is per-profile.
 *
 * ## Why it exists at all
 *
 * Because the confidence floor does not work, measured. The two edges that had
 * to be revoked scored **0.90 and 0.95**, and across three proposal rounds the
 * model ran roughly 90% correct while the wrong 10% cost more precision than
 * the right 90% bought (planning/SKILL-ONTOLOGY.md § Human review, priced).
 * Nothing but a person reading them separates the current 100% precision from
 * quiet decay, and until now that person needed a terminal.
 *
 * Rejection sets `approved_at` back to null rather than deleting: a rejected
 * proposal that is simply removed comes straight back on the next run of
 * `propose-skill-relations.ts`, which would make review Sisyphean. The row
 * stays, unapproved, and `ON CONFLICT DO NOTHING` leaves it alone.
 */
import { fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export interface PendingRelation {
	id: number;
	from_label: string;
	to_label: string;
	relation: string;
	confidence: number | null;
	source: string;
	approved: boolean;
	/**
	 * An approved edge already connects these two concepts, in one direction or
	 * the other, so there is nothing left for a reviewer to decide.
	 *
	 * Two cases, both real on dev rather than hypothetical:
	 *
	 *  - **Same direction, different relation.** `covers` arrived after the
	 *    proposer had spent three rounds describing compound entries as
	 *    hierarchies, and the moment "Vitest / Jest covers Jest" was approved,
	 *    "Vitest / Jest is a kind of Jest" became a question with no consequence
	 *    attached to either answer.
	 *  - **The reverse is approved.** "Agile/Scrum covers Scrum" is in use, so
	 *    "Scrum is a kind of Agile/Scrum" — which the proposer offered at 0.98 —
	 *    cannot also be true. Approving it would assert mutual implication, and
	 *    mutual implication is what `skill_aliases` is for.
	 *
	 * They stay in the table, because a deleted proposal comes straight back on
	 * the next pipeline run. They are simply not review.
	 */
	superseded: boolean;
}

export interface PendingAlias {
	id: number;
	alias: string;
	label: string;
	source: string;
	approved: boolean;
}

export const load: PageServerLoad = async () => {
	const [relations, aliases, counts] = await Promise.all([
		queryRawDirect<PendingRelation>(sql`
			SELECT r.id, f.label AS from_label, t.label AS to_label, r.relation,
			       r.confidence, r.source, (r.approved_at IS NOT NULL) AS approved,
			       EXISTS (
			         SELECT 1 FROM skill_relations o
			         WHERE o.approved_at IS NOT NULL AND o.id <> r.id
			           AND ((o.from_id = r.from_id AND o.to_id = r.to_id)
			             OR (o.from_id = r.to_id AND o.to_id = r.from_id))
			       ) AS superseded
			FROM skill_relations r
			JOIN skill_concepts f ON f.id = r.from_id
			JOIN skill_concepts t ON t.id = r.to_id
			ORDER BY r.approved_at NULLS FIRST, r.confidence DESC NULLS LAST, f.label
		`),
		queryRawDirect<PendingAlias>(sql`
			SELECT a.id, a.alias, c.label, a.source, (a.approved_at IS NOT NULL) AS approved
			FROM skill_aliases a
			JOIN skill_concepts c ON c.id = a.concept_id
			ORDER BY a.approved_at NULLS FIRST, c.label
		`),
		queryRawDirect<{ concepts: number; edges: number; aliases: number }>(sql`
			SELECT
				(SELECT count(*)::int FROM skill_concepts) AS concepts,
				(SELECT count(*)::int FROM skill_relations WHERE approved_at IS NOT NULL) AS edges,
				(SELECT count(*)::int FROM skill_aliases WHERE approved_at IS NOT NULL) AS aliases
		`)
	]);

	return { relations, aliases, stats: counts[0] ?? { concepts: 0, edges: 0, aliases: 0 } };
};

function idFrom(form: FormData): number | null {
	const id = parseInt(String(form.get('id') ?? ''), 10);
	return Number.isInteger(id) ? id : null;
}

export const actions: Actions = {
	approveRelation: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_relations SET approved_at = now() WHERE id = ${id}`);
		return { success: true };
	},

	rejectRelation: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_relations SET approved_at = NULL WHERE id = ${id}`);
		return { success: true };
	},

	/**
	 * Swap an edge's ends.
	 *
	 * Here because inverted direction is the failure mode this whole table
	 * exists to prevent, and `Python → Django` is one click from correct rather
	 * than something to delete and wait for the model to re-propose the other
	 * way round. Approval is deliberately NOT granted by flipping — a corrected
	 * edge is still an unreviewed claim.
	 */
	flipRelation: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		// The unique index is on (from_id, to_id, relation), so the reverse edge
		// may already exist; leave the original alone rather than fail the update.
		const clash = await queryRawDirect<{ n: number }>(sql`
			SELECT count(*)::int AS n FROM skill_relations x
			JOIN skill_relations o ON o.id = ${id}
			WHERE x.from_id = o.to_id AND x.to_id = o.from_id AND x.relation = o.relation
		`);
		if ((clash[0]?.n ?? 0) > 0) {
			return fail(409, { error: 'The reverse edge already exists — reject this one instead.' });
		}
		await db.execute(sql`
			UPDATE skill_relations
			SET from_id = to_id, to_id = from_id, approved_at = NULL, source = 'manual'
			WHERE id = ${id}
		`);
		return { success: true };
	},

	approveAlias: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_aliases SET approved_at = now() WHERE id = ${id}`);
		return { success: true };
	},

	rejectAlias: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_aliases SET approved_at = NULL WHERE id = ${id}`);
		return { success: true };
	}
};
