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
import {
	expandForRetrieval,
	expandUpward,
	expandUpwardBySeed,
	impliesSkill,
	MATCHING_RELATIONS
} from '../src/lib/server/job/skill-ontology';
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
	['zzreact', 'zzit', 'inDomain'],
	['zzreact', 'zzdjango', 'related']
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
	['ZZReact', 'ZZIT', false],
	// `related` is the other drawn-but-not-walked relation, and it is the one that
	// would do the most damage if walked: it is symmetric, so admitting it puts
	// back exactly the false positives the ontology was built to remove.
	['ZZReact', 'ZZDjango', false]
];

let failures = 0;
function check(ok: boolean, what: string) {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}`);
	if (!ok) failures++;
}

/**
 * A cycle over the relations the matcher walks, as slugs, or `null` if the graph
 * is acyclic.
 *
 * Kahn's peel rather than a recursive CTE, on purpose. Enumerating paths from
 * every concept to spot a repeat is exponential on a dense DAG, and this runs
 * against the whole live graph rather than the fixtures. Repeatedly dropping
 * concepts with nothing left above them strands exactly the ones on a cycle, in
 * one pass over the edges, and a walk from any survivor closes the loop to name.
 *
 * Edges point child to ancestor, so the sinks being peeled are the roots.
 */
async function findMatchingCycle(): Promise<string[] | null> {
	const edges = await queryRawDirect<{ from_slug: string; to_slug: string }>(sql`
		SELECT f.slug AS from_slug, t.slug AS to_slug
		FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE r.approved_at IS NOT NULL
		  AND r.relation IN (${sql.join(
				MATCHING_RELATIONS.map((rel) => sql`${rel}`),
				sql`, `
			)})
	`);

	const up = new Map<string, string[]>();
	const down = new Map<string, string[]>();
	const link = (m: Map<string, string[]>, from: string, to: string) =>
		m.set(from, [...(m.get(from) ?? []), to]);
	for (const { from_slug: child, to_slug: ancestor } of edges) {
		link(up, child, ancestor);
		link(down, ancestor, child);
		if (!up.has(ancestor)) up.set(ancestor, []);
	}

	const remaining = new Map([...up].map(([slug, above]) => [slug, above.length]));
	const roots = [...remaining].filter(([, n]) => n === 0).map(([slug]) => slug);
	for (let slug = roots.pop(); slug !== undefined; slug = roots.pop()) {
		remaining.delete(slug);
		for (const child of down.get(slug) ?? []) {
			const n = remaining.get(child);
			if (n === undefined) continue;
			remaining.set(child, n - 1);
			if (n - 1 === 0) roots.push(child);
		}
	}
	if (remaining.size === 0) return null;

	// Every survivor still has somewhere to go among the survivors, so this walk
	// cannot get stuck and must repeat a slug. The tail before the repeat is a
	// path INTO the cycle, not part of it, so report from the repeat onward.
	const path: string[] = [];
	let slug: string | undefined = [...remaining.keys()][0];
	while (slug !== undefined && !path.includes(slug)) {
		path.push(slug);
		slug = (up.get(slug) ?? []).find((next) => remaining.has(next));
	}
	return slug === undefined ? null : [...path.slice(path.indexOf(slug)), slug];
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

await db.execute(sql`
	INSERT INTO skill_aliases (concept_id, alias, source, approved_at)
	SELECT c.id, 'zzreactjs', 'seed', now() FROM skill_concepts c WHERE c.slug = 'zzreact'
	ON CONFLICT DO NOTHING
`);

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

	// The other whole-graph invariant, and the one the traversal cannot defend
	// itself against: what the matcher walks has to be acyclic. `expandUpward` is
	// bounded by depth, not by cycle detection, so a loop does not hang or error,
	// it just makes every concept on it imply every other and reports that as an
	// ordinary answer.
	//
	// `refuseNewRelation` guards both doors a person can draw an edge through, so
	// this is not checking that guard. It is checking the door with no guard on
	// it: `importOntology` inserts rows with `approved_at` already set, so a cycle
	// can arrive whole from another instance without anything asking.
	//
	// MATCHING_RELATIONS only. `inDomain` may close a loop deliberately (asserted
	// below) and nothing traverses it.
	const cycle = await findMatchingCycle();
	check(cycle === null, `the matching graph is acyclic${cycle ? `: ${cycle.join(' -> ')}` : ''}`);

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

	// --- What a cycle does once one is in ------------------------------------
	//
	// The complement of the acyclicity check above: not "is there a loop" but
	// "what happens when there is". Inserted with raw SQL precisely because
	// `createRelation` would refuse it, which is the shape `importOntology` has.
	//
	// Nothing here detects the loop. The traversal terminates on its depth cap,
	// returns a sane-looking set, and cheerfully reports that ZZfrontend implies
	// ZZReact. That is the whole reason acyclicity has to be asserted separately:
	// there is no answer this walk gives that would tell you.
	await db.execute(sql`
		INSERT INTO skill_relations (from_id, to_id, relation, source, approved_at)
		SELECT f.id, t.id, 'broader', 'seed', now()
		FROM skill_concepts f, skill_concepts t
		WHERE f.slug = 'zzfrontend' AND t.slug = 'zzreact'
		ON CONFLICT DO NOTHING
	`);
	try {
		const capped = await expandUpward(['ZZReact'], 1);
		check(capped.length === 2, `the depth cap truncates the walk (got ${capped.length}, want 2)`);

		// 32 is LOOP_SEARCH_DEPTH, the depth the loop guard itself walks at, and so
		// the one that has to stay survivable on a graph that already has a loop.
		const deep = await expandUpward(['ZZReact'], 32);
		check(
			deep.length === 4,
			`a cycle terminates at depth 32 with the same 4 concepts (got ${deep.length})`
		);
		check(
			deep.every((c) => c.depth < 4),
			'looping does not inflate the reported depths, since MIN() takes the short path'
		);
		check(
			await impliesSkill('ZZfrontend', 'ZZReact'),
			'and the loop silently reverses an implication, which is the damage'
		);
	} finally {
		await db.execute(sql`
			DELETE FROM skill_relations
			WHERE relation = 'broader'
			  AND from_id = (SELECT id FROM skill_concepts WHERE slug = 'zzfrontend')
			  AND to_id = (SELECT id FROM skill_concepts WHERE slug = 'zzreact')
		`);
	}
	check(
		!(await impliesSkill('ZZfrontend', 'ZZReact')),
		'the loop fixture is gone again before the rest of the file runs'
	);

	// --- The retrieval traversal, which is a different walk ------------------
	//
	// `expandForRetrieval` answers "is this project worth showing?" rather than
	// "may this profile claim this skill?", so it takes one `related` hop the
	// match path refuses. Every assertion here is about the SQL — seed
	// attribution and a sideways UNION that `expandUpward` has neither — and a
	// mocked database would answer all of them by construction. `retrieval.test.ts`
	// mocks this function, so this file is the only place its query runs.
	const near = await expandForRetrieval(['ZZReact', 'ZZDjango']);
	const reactReach = (near.get('zzreact') ?? []).map((c) => c.slug);
	const djangoReach = (near.get('zzdjango') ?? []).map((c) => c.slug);

	check(near.size === 2, `retrieval keys its result by seed, one per input (got ${near.size})`);
	check(reactReach.includes('zzfrontend'), 'retrieval still walks upward (ZZReact → ZZfrontend)');

	// The `related` hop, and the two ways it must be bounded.
	check(reactReach.includes('zzdjango'), 'retrieval takes one `related` hop (ZZReact → ZZDjango)');
	check(djangoReach.includes('zzreact'), '`related` is symmetric: ZZDjango → ZZReact as well');
	check(
		!reactReach.includes('zzpython'),
		'`related` does not compose — ZZReact stops at ZZDjango, short of ZZPython'
	);
	check(
		!djangoReach.includes('zzjsframework'),
		'the sideways hop does not feed the upward walk in the other direction either'
	);

	// Seeds must not pool. A flat union would give every project every other
	// project's ancestors and they would all rank identically.
	check(
		!djangoReach.includes('zzfrontend'),
		"seed attribution holds: ZZDjango does not inherit ZZReact's ancestors"
	);

	// `related` is the ONLY drawn-only relation retrieval admits. `inDomain` stays
	// out of both walks, or a project would be widened to "IT".
	check(!reactReach.includes('zzit'), 'retrieval does not walk inDomain');

	// The fence, stated as a pair: this same approved edge is asserted false for
	// `impliesSkill` in CASES above. One relation, two functions, opposite answers
	// — which is the design, and this is where it is held in place.
	check(
		reactReach.includes('zzdjango') && !(await impliesSkill('ZZReact', 'ZZDjango')),
		'the same `related` edge is walked by retrieval and refused by matching'
	);

	// `expandUpwardBySeed` is the same walk with the sideways hop off — the
	// traversal CV tailoring asks coverage questions with. Asserted as a PAIR
	// against the same fixture edge, because the only thing separating them is
	// one UNION and a boolean, and a regression there would be silent: coverage
	// would start answering a MySQL requirement with a MariaDB line.
	const upOnly = await expandUpwardBySeed(['ZZReact']);
	const upOnlyReach = (upOnly.get('zzreact') ?? []).map((c) => c.slug);
	check(upOnlyReach.includes('zzfrontend'), 'seeded upward walk still reaches ZZfrontend');
	check(
		!upOnlyReach.includes('zzdjango'),
		'seeded upward walk does NOT take the `related` hop that retrieval does'
	);
	check(
		reactReach.includes('zzdjango') && !upOnlyReach.includes('zzdjango'),
		'the two seeded walks differ by exactly that hop'
	);

	const aliased = await expandForRetrieval(['ZZReactJS']);
	const aliasReach = (aliased.get('zzreactjs') ?? []).map((c) => c.slug);
	check(aliased.has('zzreactjs'), 'an alias seed is keyed by the alias, not by its concept');
	check(
		aliasReach.includes('zzjavascript'),
		'an alias seed reaches everything its concept reaches'
	);
} finally {
	await db.execute(sql`
		DELETE FROM skill_aliases WHERE concept_id IN (SELECT id FROM skill_concepts WHERE slug LIKE 'zz%')
	`);
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
