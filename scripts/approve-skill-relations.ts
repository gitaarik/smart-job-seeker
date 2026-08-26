/**
 * Promote proposed skill relations so the matcher will traverse them.
 *
 * Separate from proposing, and deliberately so. A wrong edge is invisible and
 * global — it changes every future match for every profile and nothing surfaces
 * it — so nothing the LLM produced influences a match until it is promoted
 * here. `expandUpward` filters on `approved_at IS NOT NULL`.
 *
 *   docker compose exec -T app npx tsx scripts/approve-skill-relations.ts            # list pending
 *   docker compose exec -T app npx tsx scripts/approve-skill-relations.ts --min 0.9  # promote
 *   docker compose exec -T app npx tsx scripts/approve-skill-relations.ts --revoke 12
 *
 * A confidence floor is NOT human review and this script does not pretend
 * otherwise — it is the bulk path for establishing a measurement, and the
 * product path is the applicant approving in the app. See
 * planning/SKILL-ONTOLOGY.md.
 *
 * This is the THIRD door an edge can come through, after drawing one on the
 * graph and approving one in the review queue, and for a while it was the only
 * unguarded one. It promoted two cycles into the matcher — `DevOps ⇄ Deployment`
 * and `Containerization ⇄ Container orchestration` — because a batch written as
 * one `UPDATE … WHERE source = …` checks no row against any other, so a batch
 * holding both `A→B` and `B→A` approved both. Every path here now goes through
 * `approveGuarded`.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { refuseNewRelation } from '../src/lib/server/job/skill-relation-guards';

const args = process.argv.slice(2);
const minIdx = args.indexOf('--min');
const MIN = minIdx > -1 ? Number(args[minIdx + 1]) : null;
const revokeIdx = args.indexOf('--revoke');
const REVOKE = revokeIdx > -1 ? Number(args[revokeIdx + 1]) : null;

const ALIASES = args.includes('--aliases');
/**
 * Promote a whole batch by where it came from.
 *
 * `--min` cannot separate this vocabulary: of 190 category proposals, 67 sit at
 * exactly 0.90 and every one of the rest is between 0.90 and 0.99, wrong ones
 * included. The model is confident about `Groq broader Programming languages`.
 *
 * A source is the honest unit instead — it says "this run, which I read as a
 * whole". Pair it with the eval: 33 negative labels is a far better test of a
 * batch than a floor on a number the model made up. Undo the batch with
 * `--revoke-source <source>` if the numbers say to.
 */
const sourceIdx = args.indexOf('--source');
const SOURCE = sourceIdx > -1 ? args[sourceIdx + 1] : null;
const revokeSourceIdx = args.indexOf('--revoke-source');
const REVOKE_SOURCE = revokeSourceIdx > -1 ? args[revokeSourceIdx + 1] : null;

interface Pending {
	id: number;
	from_id: number;
	to_id: number;
	from_label: string;
	to_label: string;
	relation: string;
	confidence: number | null;
}

/**
 * Undecided relations, optionally narrowed to one proposal run.
 *
 * `rejected_at IS NULL` matters: a rejected row is unapproved too, and without
 * the filter every `--approve --all` would re-offer everything a reviewer has
 * already turned down.
 */
async function fetchPending(source: string | null = null): Promise<Pending[]> {
	const scope = source === null ? sql`TRUE` : sql`r.source = ${source}`;
	return queryRawDirect<Pending>(sql`
		SELECT r.id, r.from_id, r.to_id, r.relation, r.confidence,
		       f.label AS from_label, t.label AS to_label
		FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE r.approved_at IS NULL AND r.rejected_at IS NULL AND ${scope}
		ORDER BY r.confidence DESC NULLS LAST, f.label
	`);
}

/**
 * Approve rows one at a time, refusing any that would contradict the graph.
 *
 * The loop is the point. A batch promoted as a single `UPDATE … WHERE source =`
 * checks no row against any other, so one holding both `A→B` and `B→A` approved
 * both and nothing said so — which is how `DevOps ⇄ Deployment` and
 * `Containerization ⇄ Container orchestration` reached the matcher and made
 * those four skills imply each other in both directions. Approving in sequence
 * means every row is checked against the ones already approved, its own
 * batch-mates included.
 *
 * Order therefore decides which half of a contradictory pair survives, and that
 * order is arbitrary — which is exactly why each refusal is printed in full
 * rather than counted. A batch that silently drops rows reads as one that
 * applied cleanly, and the pair it dropped is the pair someone needs to look at.
 */
async function approveGuarded(rows: Pending[]): Promise<{ ok: number; refused: number }> {
	let ok = 0;
	const refusals: string[] = [];

	for (const r of rows) {
		// `r.id` as `exceptId`: the row being approved must not find itself in the
		// duplicate check.
		const refusal = await refuseNewRelation(r.from_id, r.to_id, r.relation, r.id);
		if (refusal) {
			refusals.push(
				`  [${r.id}] ${r.from_label} —${r.relation}→ ${r.to_label}\n        ${refusal.error}`
			);
			continue;
		}
		await db.execute(sql`
			UPDATE skill_relations SET approved_at = now(), rejected_at = NULL WHERE id = ${r.id}
		`);
		ok++;
	}

	if (refusals.length > 0) {
		console.log(`\nRefused ${refusals.length} relation(s), left pending:\n`);
		for (const line of refusals) console.log(line);
		console.log('');
	}
	return { ok, refused: refusals.length };
}

if (ALIASES && REVOKE !== null) {
	await db.execute(sql`UPDATE skill_aliases SET approved_at = NULL WHERE id = ${REVOKE}`);
	console.log(`Revoked alias ${REVOKE}; it will stop resolving.`);
	process.exit(0);
}

if (ALIASES) {
	const rows = await queryRawDirect<{
		id: number;
		alias: string;
		label: string;
		approved: boolean;
	}>(sql`
		SELECT a.id, a.alias, c.label, (a.approved_at IS NOT NULL) AS approved
		FROM skill_aliases a JOIN skill_concepts c ON c.id = a.concept_id
		WHERE a.rejected_at IS NULL
		ORDER BY a.approved_at NULLS FIRST, c.label
	`);
	const APPROVE = args.indexOf('--approve');
	if (APPROVE > -1) {
		// Explicit ids only. There is no confidence floor for aliases and there
		// will not be one: an alias makes one concept answer for another in both
		// directions at once, which is a larger claim than an edge, and the floor
		// already let two wrong edges through at 0.90 and 0.95.
		const ids = args
			.slice(APPROVE + 1)
			.filter((a) => /^\d+$/.test(a))
			.map(Number);
		for (const id of ids) {
			await db.execute(sql`
				UPDATE skill_aliases SET approved_at = now(), rejected_at = NULL WHERE id = ${id}
			`);
		}
		console.log(`Approved ${ids.length} alias(es): ${ids.join(', ')}`);
		process.exit(0);
	}
	console.log(`${rows.length} alias(es):\n`);
	for (const r of rows) {
		console.log(`  [${r.id}] ${r.approved ? '✓' : ' '} "${r.alias}" → ${r.label}`);
	}
	console.log('\nPass --aliases --approve <id…> to accept, or --aliases --revoke <id>.');
	process.exit(0);
}

if (REVOKE_SOURCE !== null) {
	const rows = await queryRawDirect<{ n: number }>(sql`
		WITH done AS (
			UPDATE skill_relations SET approved_at = NULL
			WHERE source = ${REVOKE_SOURCE} AND approved_at IS NOT NULL RETURNING 1
		) SELECT count(*)::int AS n FROM done
	`);
	console.log(`Revoked ${rows[0]?.n ?? 0} relation(s) from source "${REVOKE_SOURCE}".`);
	process.exit(0);
}

if (SOURCE !== null) {
	const rows = await fetchPending(SOURCE);
	const { ok, refused } = await approveGuarded(rows);
	console.log(`Promoted ${ok} of ${rows.length} relation(s) from source "${SOURCE}".`);
	if (refused > 0) console.log(`${refused} refused above and still pending.`);
	console.log('Now run eval-skill-matching.ts. If precision moved, --revoke-source undoes it.');
	process.exit(0);
}

if (REVOKE !== null) {
	await db.execute(sql`UPDATE skill_relations SET approved_at = NULL WHERE id = ${REVOKE}`);
	console.log(`Revoked relation ${REVOKE}; the matcher will stop traversing it.`);
	process.exit(0);
}

const pending = await fetchPending();

if (MIN === null) {
	console.log(`${pending.length} pending relation(s):\n`);
	for (const p of pending) {
		console.log(
			`  [${p.id}] ${p.from_label} —${p.relation}→ ${p.to_label}` +
				`  (${p.confidence?.toFixed(2) ?? '—'})`
		);
	}
	console.log('\nPass --min <confidence> to promote, or --revoke <id> to undo one.');
	console.log('Or --source <source> to promote a whole run, --revoke-source <source> to undo it.');
	process.exit(0);
}

const overFloor = pending.filter((p) => (p.confidence ?? 0) >= MIN);
const { ok } = await approveGuarded(overFloor);
console.log(`Promoted ${ok} of ${pending.length} relation(s) at confidence >= ${MIN}.`);
console.log(`${pending.length - ok} left pending.`);
process.exit(0);
