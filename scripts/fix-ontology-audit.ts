/**
 * One-off: apply the 2026-08-30 ontology audit.
 *
 * Rejects rather than retires, because every row here is a ruling that the
 * claim is FALSE, not merely that the edge is unwanted — and `rejected_at` is
 * what stops `propose-skill-relations.ts` (ON CONFLICT DO NOTHING) offering it
 * again. Reversible from the queue's Restore button, one row at a time.
 *
 * Creates go through `refuseNewRelation`, the same guard the graph page uses,
 * so a replacement edge cannot close a loop.
 *
 *   docker compose exec -T app npx tsx scripts/fix-ontology-audit.ts --dry
 *   docker compose exec -T app npx tsx scripts/fix-ontology-audit.ts --apply
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { refuseNewRelation } from '../src/lib/server/job/skill-relation-guards';

const APPLY = process.argv.includes('--apply');

/** [id, from, relation, to, why] — labels are asserted, not decoration. */
type Reject = [number, string, string, string, string];

const FALSE_MATCHES: Reject[] = [
	[
		827,
		'Design',
		'broader',
		'Software development',
		'design is not a kind of software development'
	],
	[
		554,
		'Design tools',
		'broader',
		'Developer tools',
		'routes Illustrator/InDesign/Figma into software development'
	],
	[
		863,
		'Project management',
		'broader',
		'Software development processes',
		'inverted; reversed below'
	],
	[
		871,
		'Analytics',
		'broader',
		'Data Science',
		'pulls Google Analytics, Power BI, Tableau into data science'
	],
	[865, 'Prompt design', 'broader', 'AI coding tools', 'a practice is not a kind of tool category']
];

const WRONG_PARENT: Reject[] = [
	[760, 'Bash', 'broader', 'Operating systems', 'a shell is not an OS'],
	[
		732,
		'GraphQL',
		'broader',
		'Programming languages',
		'query language; Data query languages added below'
	],
	[792, 'Taxonomies', 'broader', 'Data formats', 'not a format'],
	[794, 'Terraform', 'broader', 'Cloud platforms', 'not a cloud platform'],
	[
		420,
		'Azure OpenAI',
		'broader',
		'Cloud platforms',
		'a service ON one; requires Azure added below'
	],
	[790, 'Tailwind CSS', 'broader', 'Design tools', 'a CSS framework, not a design tool'],
	[702, 'YAML', 'broader', 'Developer tools', 'a format; Data formats already there'],
	[730, 'Parquet', 'broader', 'Data Science', 'a file format is not a discipline'],
	[699, 'Code review', 'broader', 'Developer tools', 'a practice, not a tool'],
	[447, 'Code review', 'broader', 'Software Design', 'not a kind of software design'],
	[587, 'Security', 'broader', 'Software Design', 'not a kind of software design'],
	[
		701,
		'Jira',
		'broader',
		'Developer tools',
		'second path from project work into software development'
	],
	[1194, 'MongoDB', 'requires', 'JSON', 'stores BSON; running Mongo implies no JSON experience']
];

const RELATED_UNTRUE: Reject[] = [
	[1348, 'WordPress', 'related', 'CRM', 'WordPress is a CMS'],
	[1357, 'Scalability', 'related', 'Scaling startups', 'a pun on "scaling"'],
	[1270, 'Monitoring', 'related', 'Security', 'shares only "operational concern"'],
	[1273, 'Observability', 'related', 'Security', 'shares only "operational concern"'],
	[1271, 'Maintenance', 'related', 'Security', 'shares only "operational concern"'],
	[1274, 'Jest', 'related', 'React', 'not an alternative to React']
];

const RELATED_IMPLIED: Reject[] = [
	[1257, 'API testing', 'related', 'Unit Testing', 'implication path already connects them'],
	[885, 'Next.js', 'related', 'Backend development', 'implication path already connects them'],
	[886, 'SvelteKit', 'related', 'Backend development', 'implication path already connects them']
];

/** [from, relation, to, why] — resolved by label, guarded before insert. */
const CREATE: [string, string, string, string][] = [
	[
		'Software development processes',
		'broader',
		'Project management',
		'the correct direction of #863'
	],
	['Code review', 'broader', 'Engineering practices', 'replaces both rejected parents'],
	['GraphQL', 'broader', 'Data query languages', 'where SQL already sits'],
	['Azure OpenAI', 'requires', 'Azure', 'restores the cloud reach, correctly'],
	['Kubernetes/OpenShift', 'covers', 'Kubernetes', 'isolated compound, both parts present'],
	['RHEL/Linux', 'covers', 'Linux', 'isolated compound, both parts present']
];

interface Row {
	id: number;
	from_label: string;
	to_label: string;
	relation: string;
	approved: boolean;
	rejected: boolean;
}

async function load(ids: number[]): Promise<Map<number, Row>> {
	if (ids.length === 0) return new Map();
	const rows = await queryRawDirect<Row>(sql`
		SELECT r.id, r.relation, f.label AS from_label, t.label AS to_label,
		       (r.approved_at IS NOT NULL) AS approved,
		       (r.rejected_at IS NOT NULL) AS rejected
		FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE r.id IN (${sql.join(
			ids.map((i) => sql`${i}`),
			sql`, `
		)})
	`);
	return new Map(rows.map((r) => [r.id, r]));
}

let rejected = 0;
let created = 0;
const problems: string[] = [];

async function rejectGroup(title: string, group: Reject[]) {
	console.log(`\n── ${title} (${group.length})`);
	const rows = await load(group.map((g) => g[0]));
	for (const [id, from, relation, to, why] of group) {
		const row = rows.get(id);
		if (!row) {
			problems.push(`#${id} not found`);
			console.log(`  SKIP #${id} — no such row`);
			continue;
		}
		// The id is the address, but the labels are the claim. If they disagree the
		// table moved under this script and nothing here should be trusted.
		if (row.from_label !== from || row.to_label !== to || row.relation !== relation) {
			problems.push(
				`#${id} is "${row.from_label} ${row.relation} ${row.to_label}", expected "${from} ${relation} ${to}"`
			);
			console.log(`  SKIP #${id} — label mismatch`);
			continue;
		}
		if (row.rejected) {
			console.log(`  already rejected #${id}  ${from} ${relation} ${to}`);
			continue;
		}
		if (APPLY) {
			await db.execute(sql`
				UPDATE skill_relations SET rejected_at = now(), approved_at = NULL WHERE id = ${id}
			`);
		}
		rejected++;
		console.log(`  reject #${id}  ${from} ${relation} ${to}  — ${why}`);
	}
}

async function rejectPending() {
	const pending = await queryRawDirect<Row>(sql`
		SELECT r.id, r.relation, f.label AS from_label, t.label AS to_label,
		       false AS approved, false AS rejected
		FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE r.approved_at IS NULL AND r.rejected_at IS NULL
		ORDER BY r.id
	`);
	console.log(`\n── pending queue, every row adds nothing (${pending.length})`);
	for (const p of pending) {
		if (APPLY) {
			await db.execute(sql`
				UPDATE skill_relations SET rejected_at = now() WHERE id = ${p.id}
			`);
		}
		rejected++;
		console.log(`  reject #${p.id}  ${p.from_label} ${p.relation} ${p.to_label}`);
	}
}

async function createEdges() {
	console.log(`\n── replacements (${CREATE.length})`);
	for (const [from, relation, to, why] of CREATE) {
		const ends = await queryRawDirect<{ id: number; label: string }>(sql`
			SELECT id, label FROM skill_concepts WHERE label IN (${from}, ${to})
		`);
		const a = ends.find((c) => c.label === from);
		const b = ends.find((c) => c.label === to);
		if (!a || !b) {
			problems.push(`concept missing for "${from} ${relation} ${to}"`);
			console.log(`  SKIP ${from} ${relation} ${to} — concept not found`);
			continue;
		}
		// Checked before the guard, not after: `refuseNewRelation` refuses a pair
		// already joined in EITHER direction, so on a second run it refuses this
		// script's own edge as a clash. That is the guard working — it just is not
		// a problem, and a re-run has to be able to say so and exit 0.
		const done = await queryRawDirect<{ id: number }>(sql`
			SELECT id FROM skill_relations
			WHERE from_id = ${a.id} AND to_id = ${b.id} AND relation = ${relation}
			  AND approved_at IS NOT NULL
		`);
		if (done.length > 0) {
			console.log(`  already drawn #${done[0].id}  ${from} ${relation} ${to}`);
			continue;
		}

		const refusal = await refuseNewRelation(a.id, b.id, relation);
		if (refusal) {
			problems.push(`refused "${from} ${relation} ${to}": ${refusal.error}`);
			console.log(`  REFUSED ${from} ${relation} ${to} — ${refusal.error}`);
			continue;
		}
		if (APPLY) {
			await db.execute(sql`
				INSERT INTO skill_relations (from_id, to_id, relation, source, approved_at)
				VALUES (${a.id}, ${b.id}, ${relation}, 'audit:2026-08-30', now())
				ON CONFLICT (from_id, to_id, relation)
				DO UPDATE SET approved_at = now(), rejected_at = NULL
			`);
		}
		created++;
		console.log(`  create ${from} ${relation} ${to}  — ${why}`);
	}
}

console.log(APPLY ? 'APPLYING' : 'DRY RUN — nothing is written');

// Order matters: the reverse of #863 cannot be drawn while #863 is approved,
// because refuseNewRelation refuses an edge between a pair already joined in
// either direction. Same for the Azure OpenAI swap.
await rejectGroup('edges producing false matches', FALSE_MATCHES);
await rejectGroup('wrong parent', WRONG_PARENT);
await rejectGroup('related — says something untrue', RELATED_UNTRUE);
await rejectGroup('related — already implied', RELATED_IMPLIED);
await rejectPending();
await createEdges();

console.log(`\n${APPLY ? 'applied' : 'would apply'}: ${rejected} rejected, ${created} created`);
if (problems.length > 0) {
	console.log(`\n${problems.length} problem(s):`);
	for (const p of problems) console.log(`  ! ${p}`);
	process.exit(1);
}
process.exit(0);
