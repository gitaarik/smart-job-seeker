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
 * ## Reject, revoke and restore are three different writes
 *
 * Nothing here deletes. A proposal that is simply removed comes straight back
 * on the next run of `propose-skill-relations.ts`, which inserts
 * `ON CONFLICT DO NOTHING`, so review would be Sisyphean. The row stays and
 * carries the verdict:
 *
 *  - **Reject** (pending → rejected) sets `rejected_at`. It used to set
 *    `approved_at = NULL`, which is what a pending row already holds — the
 *    write succeeded, changed nothing, and the row reappeared in the queue
 *    unchanged. See `skill_relations.rejected_at` in schema.ts.
 *  - **Revoke** (approved → pending) clears `approved_at` only. It is the
 *    write `retireRelation` makes from the graph, and returning the row to the
 *    queue is what makes it reversible in one click.
 *  - **Restore** (rejected → pending) clears `rejected_at`. Rejecting is one
 *    click on a list of a hundred-odd rows; without this, a misclick could only
 *    be undone in SQL.
 */
import { fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { refuseNewRelation } from '$lib/server/job/skill-relation-guards';
import type { Actions, PageServerLoad } from './$types';

export interface PendingRelation {
	id: number;
	from_label: string;
	to_label: string;
	relation: string;
	confidence: number | null;
	source: string;
	approved: boolean;
	/** A reviewer said no. Out of the queue, still in the table. */
	rejected: boolean;
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
	rejected: boolean;
}

export const load: PageServerLoad = async () => {
	const [relations, aliases, counts] = await Promise.all([
		queryRawDirect<PendingRelation>(sql`
			SELECT r.id, f.label AS from_label, t.label AS to_label, r.relation,
			       r.confidence, r.source, (r.approved_at IS NOT NULL) AS approved,
			       (r.rejected_at IS NOT NULL) AS rejected,
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
			SELECT a.id, a.alias, c.label, a.source, (a.approved_at IS NOT NULL) AS approved,
			       (a.rejected_at IS NOT NULL) AS rejected
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
	/**
	 * Approve a proposed edge, unless approving it would break the graph.
	 *
	 * The same refusals the graph editor applies when one is drawn — a loop
	 * closed by clicking Approve is the same defect as a loop closed by
	 * dragging, and nothing downstream reports either: `expandUpward` uses
	 * UNION, so a cycle terminates quietly rather than surfacing. The row's own
	 * id is excluded so it cannot be found as its own duplicate.
	 */
	approveRelation: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });

		const rows = await queryRawDirect<{ from_id: number; to_id: number; relation: string }>(
			sql`SELECT from_id, to_id, relation FROM skill_relations WHERE id = ${id}`
		);
		if (rows.length === 0) return fail(404, { error: 'Relation not found' });

		const refusal = await refuseNewRelation(rows[0].from_id, rows[0].to_id, rows[0].relation, id);
		if (refusal) return fail(refusal.status, { error: refusal.error });

		// `rejected_at` cleared as well: approving a row someone rejected earlier is
		// a change of mind, and a row that is both approved and rejected is a state
		// no reader of this table should have to interpret.
		await db.execute(sql`
			UPDATE skill_relations SET approved_at = now(), rejected_at = NULL WHERE id = ${id}
		`);
		return { success: true };
	},

	/** Pending → rejected. Out of the queue; the row stays. */
	rejectRelation: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`
			UPDATE skill_relations SET rejected_at = now(), approved_at = NULL WHERE id = ${id}
		`);
		return { success: true };
	},

	/**
	 * Approved → pending. Stops influencing matching, asks the question again.
	 *
	 * Deliberately not the same write as Reject. Retiring an edge from the graph
	 * (`retireRelation`) does exactly this and its reversibility is the point —
	 * one click puts it back in the queue. Someone who wants it gone for good can
	 * then reject it there.
	 */
	revokeRelation: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_relations SET approved_at = NULL WHERE id = ${id}`);
		return { success: true };
	},

	/** Rejected → pending. The undo for a misclick in a long list. */
	restoreRelation: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_relations SET rejected_at = NULL WHERE id = ${id}`);
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
		// Neither verdict survives the swap: the row now asserts the opposite of
		// what was approved or rejected, so it goes back to the queue as a claim
		// nobody has ruled on.
		await db.execute(sql`
			UPDATE skill_relations
			SET from_id = to_id, to_id = from_id,
			    approved_at = NULL, rejected_at = NULL, source = 'manual'
			WHERE id = ${id}
		`);
		return { success: true };
	},

	approveAlias: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`
			UPDATE skill_aliases SET approved_at = now(), rejected_at = NULL WHERE id = ${id}
		`);
		return { success: true };
	},

	/** The three alias writes, same states and same reasons as the relation ones. */
	rejectAlias: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`
			UPDATE skill_aliases SET rejected_at = now(), approved_at = NULL WHERE id = ${id}
		`);
		return { success: true };
	},

	revokeAlias: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_aliases SET approved_at = NULL WHERE id = ${id}`);
		return { success: true };
	},

	restoreAlias: async ({ request }) => {
		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid id' });
		await db.execute(sql`UPDATE skill_aliases SET rejected_at = NULL WHERE id = ${id}`);
		return { success: true };
	}
};
