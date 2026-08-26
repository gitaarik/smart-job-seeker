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
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';

const args = process.argv.slice(2);
const minIdx = args.indexOf('--min');
const MIN = minIdx > -1 ? Number(args[minIdx + 1]) : null;
const revokeIdx = args.indexOf('--revoke');
const REVOKE = revokeIdx > -1 ? Number(args[revokeIdx + 1]) : null;

if (REVOKE !== null) {
	await db.execute(sql`UPDATE skill_relations SET approved_at = NULL WHERE id = ${REVOKE}`);
	console.log(`Revoked relation ${REVOKE}; the matcher will stop traversing it.`);
	process.exit(0);
}

const pending = await queryRawDirect<{
	id: number;
	from_label: string;
	to_label: string;
	relation: string;
	confidence: number | null;
}>(sql`
	SELECT r.id, f.label AS from_label, t.label AS to_label, r.relation, r.confidence
	FROM skill_relations r
	JOIN skill_concepts f ON f.id = r.from_id
	JOIN skill_concepts t ON t.id = r.to_id
	WHERE r.approved_at IS NULL
	ORDER BY r.confidence DESC NULLS LAST, f.label
`);

if (MIN === null) {
	console.log(`${pending.length} pending relation(s):\n`);
	for (const p of pending) {
		console.log(
			`  [${p.id}] ${p.from_label} —${p.relation}→ ${p.to_label}` +
				`  (${p.confidence?.toFixed(2) ?? '—'})`
		);
	}
	console.log('\nPass --min <confidence> to promote, or --revoke <id> to undo one.');
	process.exit(0);
}

const promoted = pending.filter((p) => (p.confidence ?? 0) >= MIN);
for (const p of promoted) {
	await db.execute(sql`UPDATE skill_relations SET approved_at = now() WHERE id = ${p.id}`);
}
console.log(
	`Promoted ${promoted.length} of ${pending.length} relation(s) at confidence >= ${MIN}.`
);
console.log(`${pending.length - promoted.length} left pending.`);
process.exit(0);
