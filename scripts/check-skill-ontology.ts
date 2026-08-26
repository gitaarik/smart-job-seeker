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
import { refuseNewRelation } from '../src/lib/server/job/skill-relation-guards';

const CONCEPTS: [string, string][] = [
	['zzreact', 'ZZReact'],
	['zzjsframework', 'ZZJS framework'],
	['zzjavascript', 'ZZJavaScript'],
	['zzfrontend', 'ZZfrontend'],
	['zzdjango', 'ZZDjango'],
	['zzpython', 'ZZPython'],
	['zzvitestzzjest', 'ZZVitest / ZZJest'],
	['zzjest', 'ZZJest'],
	['zzunittesting', 'ZZUnit Testing'],
	['zzit', 'ZZIT']
];
const EDGES: [string, string, string][] = [
	['zzreact', 'zzjsframework', 'broader'],
	['zzjsframework', 'zzjavascript', 'broader'],
	['zzjavascript', 'zzfrontend', 'broader'],
	['zzdjango', 'zzpython', 'requires'],
	['zzvitestzzjest', 'zzjest', 'covers'],
	['zzjest', 'zzunittesting', 'broader'],
	['zzreact', 'zzit', 'inDomain']
];
/** [have, want, shouldMatch] — every asymmetric pair asserted BOTH ways. */
const CASES: [string, string, boolean][] = [
	['ZZReact', 'ZZJavaScript', true],
	['ZZJavaScript', 'ZZReact', false],
	['ZZReact', 'ZZfrontend', true],
	['ZZfrontend', 'ZZReact', false],
	['ZZDjango', 'ZZPython', true],
	['ZZPython', 'ZZDjango', false],
	['ZZReact', 'ZZPython', false],
	// `covers` is directional like the other two: one entry naming several
	// skills claims each of them, and no part claims the entry back.
	['ZZVitest / ZZJest', 'ZZJest', true],
	['ZZJest', 'ZZVitest / ZZJest', false],
	// The reason `covers` joined MATCHING_RELATIONS rather than getting its own
	// traversal: it composes with `broader` in one walk.
	['ZZVitest / ZZJest', 'ZZUnit Testing', true],
	['ZZUnit Testing', 'ZZVitest / ZZJest', false],
	// `inDomain` is APPROVED here and must still not be walked. It is the one
	// relation that exists for the picture rather than for matching, and the
	// whole safety of a single "IT" root over the vocabulary rests on this being
	// false — traverse it and every technical skill would satisfy a posting that
	// merely says "IT".
	['ZZReact', 'ZZIT', false]
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
	// An invariant, not a fixture assertion: a concept whose slug is not
	// normalizeSkill(label) cannot be found by the name it displays. Every
	// lookup normalises the incoming string, so such a row is reachable only
	// through an edge and never by someone typing its own name. One row had
	// drifted this way — a hand-seeded `jsframework` labelled "JavaScript
	// framework" — and it presented as expandUpward finding a concept that
	// impliesSkill then could not confirm.
	const drift = await queryRawDirect<{ slug: string; label: string }>(sql`
		SELECT slug, label FROM skill_concepts
		WHERE slug <> regexp_replace(lower(label), '[^a-z0-9+#]', '', 'g')
	`);
	check(drift.length === 0, `every concept slug matches its label (${drift.length} drifted)`);
	for (const d of drift) console.log(`         ${d.slug} vs label "${d.label}"`);

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

	// --- What the graph editor refuses to draw -------------------------------
	//
	// These run against the same seeded hierarchy because every one of them is a
	// question about the graph, not about a string: whether a pair is already
	// joined, and whether one end already reaches the other. A mocked database
	// would answer all of them by construction.
	const ids = new Map<string, number>(
		(
			await queryRawDirect<{ id: number; slug: string }>(
				sql`SELECT id, slug FROM skill_concepts WHERE slug LIKE 'zz%'`
			)
		).map((r) => [r.slug, Number(r.id)])
	);
	const id = (slug: string) => ids.get(slug) ?? -1;

	/** [from, to, relation, expect a refusal, what is being asserted] */
	const GUARDS: [string, string, string, boolean, string][] = [
		['zzreact', 'zzreact', 'broader', true, 'a concept may not imply itself'],
		['zzreact', 'zzjsframework', 'sideways', true, 'an unknown relation is refused'],
		['zzreact', 'zzjsframework', 'broader', true, 'a duplicate of an approved edge is refused'],
		['zzjsframework', 'zzreact', 'broader', true, 'the REVERSE of an approved edge is refused'],
		// zzreact reaches zzfrontend in three hops, so this closes a loop even
		// though the two are not directly joined — the case a duplicate check alone
		// would wave through.
		['zzfrontend', 'zzreact', 'broader', true, 'a transitive loop is refused'],
		// Same loop, drawn with the one relation nothing traverses. Allowed on
		// purpose: it cannot make anything imply anything.
		[
			'zzfrontend',
			'zzreact',
			'inDomain',
			false,
			'inDomain may close a loop, since it is never walked'
		],
		[
			'zzdjango',
			'zzfrontend',
			'broader',
			false,
			'an edge joining two unrelated concepts is allowed'
		]
	];

	for (const [from, to, relation, refused, what] of GUARDS) {
		const r = await refuseNewRelation(id(from), id(to), relation);
		check((r !== null) === refused, `${what} (${from} → ${to} as ${relation})`);
		if (r !== null && r.status < 400)
			check(false, `  refusal carried a non-error status ${r.status}`);
	}

	// A concept that does not exist is a 404, not a crash.
	check(
		(await refuseNewRelation(id('zzreact'), 2147483000, 'broader'))?.status === 404,
		'an unknown concept id is refused as not found'
	);

	// The review queue approves an edge that already exists as a row, so the row
	// has to be excluded from its own duplicate check. Without `exceptId` every
	// Approve click would refuse itself, which is the failure the graph editor
	// never sees because it always inserts something new.
	const own = await queryRawDirect<{ id: number }>(sql`
		SELECT r.id FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE f.slug = 'zzreact' AND t.slug = 'zzjsframework' AND r.relation = 'broader'
	`);
	check(own.length === 1, 'found the seeded ZZReact → ZZJS framework row');
	check(
		(await refuseNewRelation(id('zzreact'), id('zzjsframework'), 'broader', Number(own[0]?.id))) ===
			null,
		'a row is not its own duplicate when it is the one being approved'
	);
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
