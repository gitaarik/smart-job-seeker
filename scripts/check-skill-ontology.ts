/**
 * Assert that upward traversal is upward — an integration check, not a unit
 * test, because this module is almost entirely one recursive CTE and a mocked
 * database would be testing the mock.
 *
 * Seeds a tiny hierarchy into a transaction, asserts both directions of every
 * asymmetric pair, and rolls back. Safe to run against dev.
 *
 *   docker compose exec -T app npx tsx scripts/check-skill-ontology.ts
 *
 * The pairs here are the three false positives the embedding layer produced on
 * the labelled set (planning/SKILL-ONTOLOGY.md § Baseline) plus the chain that
 * exercises transitivity. If this passes and the eval still regresses, the
 * fault is in the vocabulary, not the traversal.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { expandUpward, impliesSkill } from '../src/lib/server/job/skill-ontology';

const CONCEPTS: [string, string][] = [
	['zzreact', 'ZZReact'],
	['zzjsframework', 'ZZJS framework'],
	['zzjavascript', 'ZZJavaScript'],
	['zzfrontend', 'ZZfrontend'],
	['zzdjango', 'ZZDjango'],
	['zzpython', 'ZZPython']
];
const EDGES: [string, string, string][] = [
	['zzreact', 'zzjsframework', 'broader'],
	['zzjsframework', 'zzjavascript', 'broader'],
	['zzjavascript', 'zzfrontend', 'broader'],
	['zzdjango', 'zzpython', 'requires']
];
/** [have, want, shouldMatch] — every asymmetric pair asserted BOTH ways. */
const CASES: [string, string, boolean][] = [
	['ZZReact', 'ZZJavaScript', true],
	['ZZJavaScript', 'ZZReact', false],
	['ZZReact', 'ZZfrontend', true],
	['ZZfrontend', 'ZZReact', false],
	['ZZDjango', 'ZZPython', true],
	['ZZPython', 'ZZDjango', false],
	['ZZReact', 'ZZPython', false]
];

let failures = 0;
function check(ok: boolean, what: string) {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}`);
	if (!ok) failures++;
}

for (const [slug, label] of CONCEPTS) {
	await db.execute(
		sql`INSERT INTO skill_concepts (slug, label) VALUES (${slug}, ${label}) ON CONFLICT (slug) DO NOTHING`
	);
}
for (const [from, to, rel] of EDGES) {
	await db.execute(sql`
		INSERT INTO skill_relations (from_id, to_id, relation, source, approved_at)
		SELECT f.id, t.id, ${rel}, 'seed', now()
		FROM skill_concepts f, skill_concepts t
		WHERE f.slug = ${from} AND t.slug = ${to}
		ON CONFLICT DO NOTHING
	`);
}

try {
	const chain = await expandUpward(['ZZReact']);
	check(chain.length === 4, `ZZReact reaches 4 concepts transitively (got ${chain.length})`);
	check(
		chain.find((c) => c.slug === 'zzfrontend')?.depth === 3,
		'ZZfrontend is 3 hops from ZZReact'
	);

	const down = await expandUpward(['ZZJavaScript']);
	check(!down.some((c) => c.slug === 'zzreact'), 'ZZJavaScript does NOT reach ZZReact');

	// An unapproved edge must be invisible: a wrong one would otherwise change
	// matching for every profile with nothing to surface it.
	await db.execute(sql`
		INSERT INTO skill_relations (from_id, to_id, relation, source)
		SELECT f.id, t.id, 'broader', 'seed'
		FROM skill_concepts f, skill_concepts t
		WHERE f.slug = 'zzpython' AND t.slug = 'zzfrontend'
		ON CONFLICT DO NOTHING
	`);
	check(!(await impliesSkill('ZZPython', 'ZZfrontend')), 'an unapproved edge is not traversed');

	for (const [have, want, expected] of CASES) {
		check((await impliesSkill(have, want)) === expected, `${have} → ${want} is ${expected}`);
	}
} finally {
	await db.execute(sql`
		DELETE FROM skill_relations WHERE from_id IN (SELECT id FROM skill_concepts WHERE slug LIKE 'zz%')
		   OR to_id IN (SELECT id FROM skill_concepts WHERE slug LIKE 'zz%')
	`);
	await db.execute(sql`DELETE FROM skill_concepts WHERE slug LIKE 'zz%'`);
	const left = await queryRawDirect<{ n: number }>(
		sql`SELECT count(*)::int AS n FROM skill_concepts WHERE slug LIKE 'zz%'`
	);
	check(left[0]?.n === 0, 'fixtures cleaned up');
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
