/**
 * Replay a set of ontology rulings against whatever database you are pointed at.
 *
 * ## Why this exists
 *
 * The 2026-08-30 audit was applied to dev by two scripts that addressed rows by
 * `skill_relations.id`. That was right for the first run — an id is exact, and
 * asserting the labels beside it caught a table that had moved. It is useless
 * anywhere else: `id` is a serial, preview and production assigned their own,
 * and the same number is a different edge on each. Run those scripts against
 * preview and every row is either "no such row" or, worse, a row that happens to
 * exist and says something else.
 *
 * `ontology-transfer.ts` is not the alternative, though it looks like it. Every
 * insert there is `ON CONFLICT DO NOTHING`, deliberately — an import adds what a
 * target is missing and never touches what it already has. That is exactly right
 * for bootstrapping and exactly wrong for propagating a cleanup: a transfer would
 * hand preview the six new edges and leave `Design broader Software development`
 * approved where it stands.
 *
 * So a ruling is addressed the way the transfer format addresses a concept: by
 * SLUG, the only identity two databases agree on. `normalizeSkill(label) === slug`
 * holds for every concept in the vocabulary (checked across all 303 on dev), so
 * the rulings stay readable as labels and resolve as slugs.
 *
 * ## Absent is not an error
 *
 * The single behavioural difference from the id-addressed originals. A ruling
 * says "this claim is false"; a target that never made the claim needs nothing
 * done. On dev every ruling found its row because dev is where they came from,
 * and on another environment some will not — that is a replay working, not
 * failing. What still counts as a problem is a target that contradicts the
 * ruling: a draw the graph refuses for its own reasons, or a concept the target
 * is actually using.
 *
 * ## Slug only, never alias
 *
 * `expandUpward` seeds from slug AND alias, and resolving that way here would
 * make the replay reach more rows on a target whose labels have drifted. It
 * would also make it reach the WRONG row when an alias points somewhere
 * unexpected, and these rulings reject and delete. Unresolved names are reported
 * by name so a person can look, which is the outcome worth having.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../../src/lib/server/db';
import { normalizeSkill } from '../../src/lib/skills';

/** `[from, relation, to, why]` — concepts named as labels, resolved as slugs. */
export type Ruling = [from: string, relation: string, to: string, why: string];

export interface Tally {
	/** Rulings that changed something. */
	applied: number;
	/** Rulings the target had already settled the same way. */
	settled: number;
	/** Rulings with nothing on this target to act on. */
	absent: number;
	/** Things a person needs to look at. */
	problems: string[];
}

export function tally(): Tally {
	return { applied: 0, settled: 0, absent: 0, problems: [] };
}

export function merge(into: Tally, from: Tally): Tally {
	into.applied += from.applied;
	into.settled += from.settled;
	into.absent += from.absent;
	into.problems.push(...from.problems);
	return into;
}

interface EdgeRow {
	id: number;
	approved: boolean;
	rejected: boolean;
}

/**
 * The one edge between this ordered pair under this relation, or null.
 *
 * At most one can exist: `skill_relations_edge_key` is unique on
 * (from_id, to_id, relation), which is also why the slug triple is a complete
 * address rather than a search.
 */
async function findEdge(from: string, relation: string, to: string): Promise<EdgeRow | null> {
	const rows = await queryRawDirect<EdgeRow>(sql`
		SELECT r.id, (r.approved_at IS NOT NULL) AS approved, (r.rejected_at IS NOT NULL) AS rejected
		FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE f.slug = ${normalizeSkill(from)}
		  AND t.slug = ${normalizeSkill(to)}
		  AND r.relation = ${relation}
	`);
	return rows[0] ?? null;
}

async function findConcept(label: string): Promise<{ id: number; label: string } | null> {
	const rows = await queryRawDirect<{ id: number; label: string }>(sql`
		SELECT id, label FROM skill_concepts WHERE slug = ${normalizeSkill(label)}
	`);
	return rows[0] ?? null;
}

/**
 * Rule a set of claims false.
 *
 * Rejects rather than retires. Retiring clears `approved_at`, which is what a
 * pending row already holds, so the proposer re-offers it and review becomes
 * Sisyphean; `rejected_at` is the durable half and `ON CONFLICT DO NOTHING` in
 * the proposer respects it. Reversible one row at a time from the queue's
 * Restore button.
 */
export async function reject(title: string, rulings: Ruling[], apply: boolean): Promise<Tally> {
	const t = tally();
	console.log(`\n── ${title} (${rulings.length})`);
	for (const [from, relation, to, why] of rulings) {
		const edge = await findEdge(from, relation, to);
		if (!edge) {
			t.absent++;
			console.log(`  absent    ${from} ${relation} ${to}`);
			continue;
		}
		if (edge.rejected) {
			t.settled++;
			console.log(`  already   #${edge.id} ${from} ${relation} ${to}`);
			continue;
		}
		if (apply) {
			await db.execute(sql`
				UPDATE skill_relations SET rejected_at = now(), approved_at = NULL WHERE id = ${edge.id}
			`);
		}
		t.applied++;
		console.log(`  reject    #${edge.id} ${from} ${relation} ${to}  — ${why}`);
	}
	return t;
}

/**
 * Draw an edge, refusing anything that would make the graph contradict itself.
 *
 * `refuseNewRelation` is imported by the caller and passed in rather than
 * imported here, because it lives under `$lib/server/job` and pulling it into
 * this module would make every script that wants a plain reject drag the
 * traversal in with it.
 */
export async function draw(
	title: string,
	draws: Ruling[],
	apply: boolean,
	guard: (from: number, to: number, relation: string) => Promise<{ error: string } | null>,
	source: string
): Promise<Tally> {
	const t = tally();
	console.log(`\n── ${title} (${draws.length})`);
	for (const [from, relation, to, why] of draws) {
		const a = await findConcept(from);
		const b = await findConcept(to);
		if (!a || !b) {
			t.absent++;
			console.log(`  absent    ${!a ? from : to} is not in this vocabulary`);
			continue;
		}
		const existing = await findEdge(from, relation, to);
		if (existing?.approved) {
			t.settled++;
			console.log(`  already   #${existing.id} ${from} ${relation} ${to}`);
			continue;
		}
		// Checked before the guard, not after: the guard refuses a pair already
		// joined in either direction, so on a second run it refuses this script's
		// own edge as a clash. That is the guard working, and it is not a problem.
		const refusal = await guard(a.id, b.id, relation);
		if (refusal) {
			t.problems.push(`refused "${from} ${relation} ${to}": ${refusal.error}`);
			console.log(`  REFUSED   ${from} ${relation} ${to} — ${refusal.error}`);
			continue;
		}
		if (apply) {
			await db.execute(sql`
				INSERT INTO skill_relations (from_id, to_id, relation, source, approved_at)
				VALUES (${a.id}, ${b.id}, ${relation}, ${source}, now())
				ON CONFLICT (from_id, to_id, relation)
				DO UPDATE SET approved_at = now(), rejected_at = NULL
			`);
		}
		t.applied++;
		console.log(`  draw      ${from} ${relation} ${to}  — ${why}`);
	}
	return t;
}

/**
 * Remove concepts that are not skills.
 *
 * The only irreversible operation here, so it re-checks its own premise on every
 * target rather than trusting the list: a concept with an approved edge or a
 * profile using it is left alone and reported. Deleting cascades to aliases and
 * relations, which is why that check is not optional.
 */
export async function deleteConcepts(
	title: string,
	concepts: [label: string, why: string][],
	apply: boolean
): Promise<Tally> {
	const t = tally();
	console.log(`\n── ${title} (${concepts.length})`);
	for (const [label, why] of concepts) {
		const c = await findConcept(label);
		if (!c) {
			t.absent++;
			console.log(`  absent    ${label}`);
			continue;
		}
		const held = await queryRawDirect<{ approved: number; used: number }>(sql`
			SELECT
				(SELECT count(*)::int FROM skill_relations r
				 WHERE (r.from_id = ${c.id} OR r.to_id = ${c.id}) AND r.approved_at IS NOT NULL) AS approved,
				(SELECT count(*)::int FROM tech_skills s WHERE s.concept_id = ${c.id}) AS used
		`);
		const { approved, used } = held[0];
		if (approved > 0 || used > 0) {
			t.problems.push(
				`"${label}" has ${approved} approved edge(s) and ${used} profile use(s) here — not deleted`
			);
			console.log(`  IN USE    ${label} — ${approved} approved edge(s), ${used} use(s)`);
			continue;
		}
		if (apply) await db.execute(sql`DELETE FROM skill_concepts WHERE id = ${c.id}`);
		t.applied++;
		console.log(`  delete    #${c.id} ${label}  — ${why}`);
	}
	return t;
}

/**
 * Fold one concept into another, keeping the dead slug resolvable as an alias.
 *
 * A concept is deleted only where nothing should resolve to it. A duplicate is
 * the opposite case: the string a person typed is fine, the row behind it is
 * not. The alias is written BEFORE the delete — if the order were reversed and
 * the second statement failed, the surface form would resolve to nothing, which
 * is worse than the duplicate it was meant to fix.
 */
export async function mergeConcept(
	title: string,
	merges: [dead: string, keep: string, why: string][],
	apply: boolean
): Promise<Tally> {
	const t = tally();
	console.log(`\n── ${title} (${merges.length})`);
	for (const [dead, keep, why] of merges) {
		const d = await findConcept(dead);
		const k = await findConcept(keep);
		if (!k) {
			t.problems.push(`merge target "${keep}" is not in this vocabulary`);
			console.log(`  MISSING   ${keep} — cannot merge "${dead}" into it`);
			continue;
		}
		if (!d) {
			t.settled++;
			console.log(`  already   "${dead}" → "${keep}"`);
			continue;
		}
		if (apply) {
			await db.execute(sql`
				INSERT INTO skill_aliases (concept_id, alias, source, approved_at)
				VALUES (${k.id}, ${normalizeSkill(dead)}, 'audit:merge', now())
				ON CONFLICT (alias) DO UPDATE SET concept_id = ${k.id}, approved_at = now()
			`);
			await db.execute(sql`DELETE FROM skill_concepts WHERE id = ${d.id}`);
		}
		t.applied++;
		console.log(`  merge     "${dead}" → "${keep}", keeping "${normalizeSkill(dead)}"  — ${why}`);
	}
	return t;
}

/**
 * Correct a label, keeping the old slug resolvable.
 *
 * Addressed by the OLD slug and idempotent on the new one, so a re-run on a
 * target already corrected reports "already" rather than failing to find
 * anything.
 */
export async function renameConcept(
	title: string,
	renames: [from: string, to: string, why: string][],
	apply: boolean
): Promise<Tally> {
	const t = tally();
	console.log(`\n── ${title} (${renames.length})`);
	for (const [from, to, why] of renames) {
		const before = await findConcept(from);
		if (!before) {
			const after = await findConcept(to);
			if (after) {
				t.settled++;
				console.log(`  already   #${after.id} "${to}"`);
			} else {
				t.absent++;
				console.log(`  absent    ${from}`);
			}
			continue;
		}
		if (apply) {
			await db.execute(sql`
				INSERT INTO skill_aliases (concept_id, alias, source, approved_at)
				VALUES (${before.id}, ${normalizeSkill(from)}, 'audit:rename', now())
				ON CONFLICT (alias) DO UPDATE SET concept_id = ${before.id}, approved_at = now()
			`);
			await db.execute(sql`
				UPDATE skill_concepts SET label = ${to}, slug = ${normalizeSkill(to)}
				WHERE id = ${before.id}
			`);
		}
		t.applied++;
		console.log(
			`  rename    #${before.id} "${from}" → "${to}", keeping "${normalizeSkill(from)}"  — ${why}`
		);
	}
	return t;
}

/** What the target holds, printed either side of a replay so the effect is visible. */
export async function snapshot(): Promise<string> {
	const rows = await queryRawDirect<{
		concepts: number;
		approved: number;
		rejected: number;
		pending: number;
	}>(sql`
		SELECT
			(SELECT count(*)::int FROM skill_concepts) AS concepts,
			(SELECT count(*)::int FROM skill_relations WHERE approved_at IS NOT NULL) AS approved,
			(SELECT count(*)::int FROM skill_relations WHERE rejected_at IS NOT NULL) AS rejected,
			(SELECT count(*)::int FROM skill_relations
			 WHERE approved_at IS NULL AND rejected_at IS NULL) AS pending
	`);
	const s = rows[0];
	return `${s.concepts} concepts · ${s.approved} approved · ${s.rejected} rejected · ${s.pending} pending`;
}

/** Print the tally and exit non-zero only if a person needs to look. */
export function report(t: Tally, apply: boolean): never {
	console.log(
		`\n${apply ? 'applied' : 'would apply'}: ${t.applied} changed, ` +
			`${t.settled} already settled, ${t.absent} not present here`
	);
	if (t.problems.length > 0) {
		console.log(`\n${t.problems.length} thing(s) to look at:`);
		for (const p of t.problems) console.log(`  ! ${p}`);
		process.exit(1);
	}
	process.exit(0);
}

/**
 * Of the concepts named in a set of `inDomain` rulings, those the rulings have
 * stranded — no domain edge of their own and no ancestor carrying one.
 *
 * The `inDomain` list in `fix-ontology-decisions.ts` is computed once against
 * dev's hierarchy: a node keeps its own domain edge only where nothing above it
 * has one. That is a decision, not a query, and re-deriving it per target would
 * silently apply a different rule to a different graph.
 *
 * The cost of that choice is that another environment's hierarchy may differ, so
 * a node whose ancestor carries the domain here may have no such ancestor there,
 * and the ruling would cut its only route. This is the check for exactly that.
 *
 * Scoped to the nodes the rulings name, deliberately. A whole-vocabulary version
 * of this question answers something else: it lists every isolated concept,
 * which on dev is seventeen nodes that never had a domain and are not this
 * script's doing. Empty on dev; anything it names elsewhere wants a domain edge
 * of its own, and is a finding rather than a failure.
 */
export async function strandedBy(labels: string[]): Promise<string[]> {
	if (labels.length === 0) return [];
	const slugs = [...new Set(labels.map(normalizeSkill))];
	return (
		await queryRawDirect<{ label: string }>(sql`
			WITH RECURSIVE domained AS (
				SELECT DISTINCT from_id AS id FROM skill_relations
				WHERE relation = 'inDomain' AND approved_at IS NOT NULL
			),
			up AS (
				SELECT c.id AS start, c.id AS at
				FROM skill_concepts c
				WHERE c.slug IN (${sql.join(
					slugs.map((s) => sql`${s}`),
					sql`, `
				)})
				UNION
				SELECT u.start, r.to_id
				FROM up u
				JOIN skill_relations r ON r.from_id = u.at
				WHERE r.relation IN ('broader', 'requires', 'covers') AND r.approved_at IS NOT NULL
			)
			SELECT c.label
			FROM skill_concepts c
			WHERE c.slug IN (${sql.join(
				slugs.map((s) => sql`${s}`),
				sql`, `
			)})
			  AND NOT EXISTS (
				SELECT 1 FROM up u JOIN domained d ON d.id = u.at WHERE u.start = c.id
			  )
			ORDER BY c.label
		`)
	).map((r) => r.label);
}
