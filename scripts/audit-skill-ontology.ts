/**
 * Audit the APPROVED graph for defects that are decidable without judgement.
 *
 *   docker compose exec -T app npx tsx scripts/audit-skill-ontology.ts [--apply]
 *   docker compose exec -T app npx tsx scripts/audit-skill-ontology.ts --merge-duplicates
 *
 * The sibling scripts all propose *new* edges. Nothing until now re-read the
 * ones already approved, so every mistake that got through review was permanent
 * — and review is the weakest link, because an edge is judged one sentence at a
 * time while its damage is transitive.
 *
 * ## What is checkable without an opinion
 *
 * Not "is this relation true" — that is what the review queue is for. These are
 * the four ways the graph contradicts *itself*, which needs no domain knowledge:
 *
 *  1. **Duplicate concept.** A concept whose slug is also an approved alias of
 *     a different concept. The vocabulary then asserts both "these are the same
 *     thing" and "these are two nodes", and which one a lookup finds is a
 *     question about `UNION` order.
 *
 *  2. **Contradiction.** An approved edge between two concepts the alias table
 *     says are the same. `Vector Stores broader vector DBs` is approved while
 *     `vectordbs` is an approved alias *of* Vector Stores — the graph says one
 *     is a kind of the other and the alias table says they are one node.
 *
 *  3. **Compound as target.** `MATCHING_RELATIONS` composes, so an edge into a
 *     compound inherits every part the compound `covers`. `API testing broader
 *     Unit / Integration Testing` therefore claims API testing implies **unit**
 *     testing, which it does not. A compound is an entry someone typed, never a
 *     category to hang things under; point at the part you mean.
 *
 *  4. **Redundant.** `from` already reaches `to` without this edge. Harmless to
 *     matching and not a bug — but this is also the picture on the whole-graph
 *     page, and an edge that changes no reachability is a line that carries no
 *     information.
 *
 * Only 1 and 2 are unambiguous errors. 4 is cosmetic — and note that redundant
 * is not the same as wrong: `Agile/Scrum covers Agile` is reachable the long way
 * round via Scrum, and is still the edge that carries the meaning.
 *
 * 3 needs care in the other direction. The *shape* is always wrong — a compound
 * is not a category — but the claims may happen to be true: `LangChain broader
 * AI / LLM integrations` over-claims nothing, because LangChain really is both.
 * So `--apply` retires the edge and queues one **unapproved** replacement per
 * covered part, which turns an invisible over-claim into two review decisions:
 * approve `API testing → Integration Testing`, reject `→ Unit Testing`.
 *
 * Everything written carries its reason in `source`, so a retired edge does not
 * read as a fresh proposal.
 *
 * ## Why merging is a separate flag
 *
 * Fixing 1 means deleting a concept row after repointing its edges, and that is
 * the only irreversible thing here. `--merge-duplicates` does it; `--apply`
 * never does.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { MATCHING_RELATIONS } from '../src/lib/server/job/skill-ontology';
import { splitCompoundSkill } from '../src/lib/skills';

const APPLY = process.argv.includes('--apply');
const MERGE = process.argv.includes('--merge-duplicates');

interface Concept {
	id: number;
	slug: string;
	label: string;
}
interface Edge {
	id: number;
	from_id: number;
	to_id: number;
	relation: string;
}

const concepts = await queryRawDirect<Concept>(
	sql`SELECT id, slug, label FROM skill_concepts ORDER BY id`
);
const aliases = await queryRawDirect<{ alias: string; concept_id: number }>(
	sql`SELECT alias, concept_id FROM skill_aliases WHERE approved_at IS NOT NULL`
);
const edges = await queryRawDirect<Edge>(sql`
	SELECT id, from_id, to_id, relation FROM skill_relations
	WHERE approved_at IS NOT NULL AND relation IN (${sql.join(
		MATCHING_RELATIONS.map((r) => sql`${r}`),
		sql`, `
	)})
	ORDER BY id
`);

const byId = new Map(concepts.map((c) => [c.id, c]));
const bySlug = new Map(concepts.map((c) => [c.slug, c]));
const name = (id: number) => byId.get(id)?.label ?? `#${id}`;

/**
 * The node a lookup *should* land on, once aliases are honoured.
 *
 * Resolved to a fixed point, because the duplicates chain: `REST API` is an
 * alias of `REST APIs`, which is itself an alias of `RESTful API`. Mapping only
 * one hop would repoint edges onto a concept the same merge then deletes — the
 * foreign key would catch it, but as a failed run rather than a correct one.
 */
const canonical = new Map<number, number>();
for (const a of aliases) {
	const dup = bySlug.get(a.alias);
	if (dup && dup.id !== a.concept_id) canonical.set(dup.id, a.concept_id);
}
for (const [dup, keep] of canonical) {
	let end = keep;
	const seen = new Set([dup]);
	while (canonical.has(end) && !seen.has(end)) {
		seen.add(end);
		end = canonical.get(end)!;
	}
	canonical.set(dup, end);
}
const canon = (id: number) => canonical.get(id) ?? id;

// ── 1. Duplicate concepts ────────────────────────────────────────────────────
const duplicates = [...canonical.entries()].map(([dup, keep]) => ({
	dup: byId.get(dup)!,
	keep: byId.get(keep)!,
	edges: edges.filter((e) => e.from_id === dup || e.to_id === dup).length
}));

// ── 2. Contradictions ────────────────────────────────────────────────────────
const contradictions = edges.filter((e) => canon(e.from_id) === canon(e.to_id));

// ── 3. Compound targets ──────────────────────────────────────────────────────
// A compound is recognised by the graph, not by its punctuation: it is a node
// that `covers` something. That keeps "CI/CD" and "GitLab CI/CD" — which look
// like compounds and are not — out of the report entirely.
const coveredBy = new Map<number, number[]>();
for (const e of edges) {
	if (e.relation !== 'covers') continue;
	if (!coveredBy.has(e.from_id)) coveredBy.set(e.from_id, []);
	coveredBy.get(e.from_id)!.push(e.to_id);
}
const compoundTargets = edges.filter(
	(e) => e.relation !== 'covers' && (coveredBy.get(e.to_id)?.length ?? 0) > 0
);

// ── 7. Compound as source ────────────────────────────────────────────────────
// The mirror of check 3, and the one that costs recall rather than precision.
// A compound is an ENTRY; the categories belong on the skills it names. When
// `Vitest / Jest broader Unit Testing` is written instead of `Jest broader Unit
// Testing`, only someone who typed the compound reaches Unit Testing — measured
// here, `Vitest / Jest → Unit Testing` was true while `Jest → Unit Testing` and
// `Vitest → Unit Testing` were both false. The category attached to the way one
// person happened to write their CV.
const compoundSources = edges.filter(
	(e) => e.relation !== 'covers' && (coveredBy.get(e.from_id)?.length ?? 0) > 0
);

// ── 4. Redundant edges ───────────────────────────────────────────────────────
const out = new Map<number, Edge[]>();
for (const e of edges) {
	if (!out.has(e.from_id)) out.set(e.from_id, []);
	out.get(e.from_id)!.push(e);
}
/** Can `from` still reach `to` with `skip` removed? */
function reaches(from: number, to: number, skip: number): boolean {
	const seen = new Set([from]);
	const queue = [from];
	while (queue.length > 0) {
		for (const e of out.get(queue.shift()!) ?? []) {
			if (e.id === skip || seen.has(e.to_id)) continue;
			if (e.to_id === to) return true;
			seen.add(e.to_id);
			queue.push(e.to_id);
		}
	}
	return false;
}
const redundant = edges.filter((e) => reaches(e.from_id, e.to_id, e.id));

// ── Report ───────────────────────────────────────────────────────────────────
function section(title: string, rows: string[], note: string) {
	console.log(`\n${title} — ${rows.length}`);
	if (rows.length === 0) return console.log('  none');
	for (const r of rows) console.log(`  ${r}`);
	console.log(`  → ${note}`);
}

console.log(
	`${concepts.length} concepts, ${edges.length} approved edges, ${aliases.length} aliases`
);

section(
	'1. DUPLICATE CONCEPTS (a concept slug that is also an alias of another)',
	duplicates.map((d) => `"${d.dup.label}" is an alias of "${d.keep.label}" — ${d.edges} edge(s)`),
	'--merge-duplicates repoints the edges and deletes the duplicate.'
);
section(
	'2. CONTRADICTIONS (an edge between two concepts the aliases call one)',
	contradictions.map((e) => `${name(e.from_id)} ${e.relation} ${name(e.to_id)}`),
	'--apply retires these.'
);
section(
	'3. COMPOUND AS TARGET (inherits every part the compound covers)',
	compoundTargets.map(
		(e) =>
			`${name(e.from_id)} ${e.relation} ${name(e.to_id)} — so it claims: ` +
			(coveredBy.get(e.to_id) ?? []).map(name).join(', ')
	),
	'--apply retires these; re-point at the part you meant.'
);
section(
	'7. COMPOUND AS SOURCE (the entry carries a category its parts do not)',
	compoundSources.map(
		(e) =>
			`${name(e.from_id)} ${e.relation} ${name(e.to_id)} — belongs on: ` +
			(coveredBy.get(e.from_id) ?? []).map(name).join(', ')
	),
	'--apply retires these and re-proposes the edge from each part.'
);
section(
	'4. REDUNDANT (already reachable without this edge)',
	redundant.map((e) => `${name(e.from_id)} ${e.relation} ${name(e.to_id)}`),
	'Cosmetic. Left alone; retire by hand if the picture is noisy.'
);

// ── 6. Undeclared duplicates ─────────────────────────────────────────────────
// Check 1 only finds duplicates someone already declared by writing an alias.
// These are the undeclared ones that are still decidable without an opinion:
// one slug is the other plus a suffix that never changes what a skill IS.
//
// This began as a plural check only, on the reasoning that anything subtler was
// a judgement — and the comment here used to name "frontend" vs "Frontend
// development" as an example of what it deliberately would not catch. Both that
// pair and `Vue`/`Vue.js` were then found by a person reading the graph, each
// having split its neighbours across two nodes exactly as the alias collisions
// did: CSS, HTML and React under `frontend`, while CSS3, MUI and Next.js sat
// under `Frontend development`. A suffix is mechanical after all.
//
// Reported, never merged automatically. `net`/`nets` and `web`/`web components`
// would both trip this, and only a human knows which pairs are one concept.
const DUP_SUFFIXES = [
	's', // api / apis
	'js', // vue / vue.js — normalizeSkill has already stripped the dot
	'development',
	'programming',
	'engineering',
	'design',
	'testing',
	'management'
];
const duplicatePairs = concepts.flatMap((c) =>
	DUP_SUFFIXES.map((suffix) => bySlug.get(`${c.slug}${suffix}`))
		.filter((other): other is Concept => other !== undefined && other.id !== c.id)
		.map((other) => ({
			one: c,
			many: other,
			oneEdges: edges.filter((e) => e.from_id === c.id || e.to_id === c.id).length,
			manyEdges: edges.filter((e) => e.from_id === other.id || e.to_id === other.id).length,
			joined: edges.some(
				(e) =>
					(e.from_id === c.id && e.to_id === other.id) ||
					(e.from_id === other.id && e.to_id === c.id)
			)
		}))
);
section(
	'6. UNDECLARED DUPLICATES (one slug is the other plus a suffix)',
	duplicatePairs.map(
		(p) =>
			`"${p.one.label}" (${p.oneEdges} edges) vs "${p.many.label}" (${p.manyEdges} edges)` +
			// An edge BETWEEN the two is the strongest signal of all: something
			// decided one is a kind of the other, which is what you write when they
			// are nearly the same thing and you cannot say why they differ.
			(p.joined ? '  [and an edge already joins them]' : '')
	),
	'Add an approved alias for one, then re-run --merge-duplicates.'
);

// A compound that no split has reached is a silent gap: `splitCompoundSkill`
// would divide the label, but nothing `covers` it, so the parts are unreachable.
const unsplit = concepts.filter(
	(c) => splitCompoundSkill(c.label).length > 0 && !coveredBy.has(c.id)
);
section(
	'5. UNSPLIT COMPOUNDS (splittable label with no covers edge)',
	unsplit.map((c) => `"${c.label}"`),
	'Run propose-skill-splits.ts; some of these are idioms and should stay whole.'
);

// ── Write ────────────────────────────────────────────────────────────────────
async function retire(rows: Edge[], reason: string) {
	for (const e of rows) {
		await db.execute(sql`
			UPDATE skill_relations SET approved_at = NULL, source = ${reason}
			WHERE id = ${e.id}
		`);
		console.log(`  retired: ${name(e.from_id)} ${e.relation} ${name(e.to_id)}`);
	}
}

if (MERGE) {
	console.log('\nMerging duplicate concepts…');
	for (const d of duplicates) {
		// Repoint first, then drop what would become self-loops or exact dupes,
		// then delete the concept. ON CONFLICT cannot help here: the unique key is
		// (from,to,relation) and the repoint can collide with an existing row.
		await db.execute(sql`
			DELETE FROM skill_relations a WHERE (a.from_id = ${d.dup.id} OR a.to_id = ${d.dup.id})
			  AND (
			    ${d.keep.id} IN (a.from_id, a.to_id)
			    OR EXISTS (
			      SELECT 1 FROM skill_relations b WHERE b.relation = a.relation AND b.id <> a.id
			        AND b.from_id = CASE WHEN a.from_id = ${d.dup.id} THEN ${d.keep.id} ELSE a.from_id END
			        AND b.to_id   = CASE WHEN a.to_id   = ${d.dup.id} THEN ${d.keep.id} ELSE a.to_id   END
			    )
			  )
		`);
		await db.execute(
			sql`UPDATE skill_relations SET from_id = ${d.keep.id} WHERE from_id = ${d.dup.id}`
		);
		await db.execute(
			sql`UPDATE skill_relations SET to_id = ${d.keep.id} WHERE to_id = ${d.dup.id}`
		);
		await db.execute(
			sql`UPDATE skill_aliases SET concept_id = ${d.keep.id} WHERE concept_id = ${d.dup.id}`
		);
		await db.execute(sql`DELETE FROM skill_concepts WHERE id = ${d.dup.id}`);
		console.log(`  merged "${d.dup.label}" into "${d.keep.label}"`);
	}
} else if (APPLY) {
	console.log('\nRetiring…');
	await retire(contradictions, 'audit:contradiction');
	await retire(compoundTargets, 'audit:compound-target');
	await retire(compoundSources, 'audit:compound-source');

	console.log('\nQueueing replacements…');
	// A compound's category moves DOWN to each part: the part is the skill, and
	// the entry only names it. Unapproved, because "both parts belong here" is
	// exactly the claim that needs a human — `Svelte / SvelteKit broader Web
	// frameworks` is true of SvelteKit and not of Svelte.
	for (const e of compoundSources) {
		for (const part of coveredBy.get(e.from_id) ?? []) {
			await db.execute(sql`
				INSERT INTO skill_relations (from_id, to_id, relation, source, confidence)
				SELECT ${part}, ${e.to_id}, ${e.relation}, 'audit:split-source', 0.5
				WHERE NOT EXISTS (
					SELECT 1 FROM skill_relations x
					WHERE x.from_id = ${part} AND x.to_id = ${e.to_id} AND x.relation = ${e.relation}
				)
			`);
			console.log(`  queued: ${name(part)} ${e.relation} ${name(e.to_id)}`);
		}
	}
	for (const e of compoundTargets) {
		for (const part of coveredBy.get(e.to_id) ?? []) {
			// Unapproved, and only if the pair is new: the point is to make the
			// over-claim visible as a decision, not to assert it.
			await db.execute(sql`
				INSERT INTO skill_relations (from_id, to_id, relation, source, confidence)
				SELECT ${e.from_id}, ${part}, ${e.relation}, 'audit:split-target', 0.5
				WHERE NOT EXISTS (
					SELECT 1 FROM skill_relations x
					WHERE x.from_id = ${e.from_id} AND x.to_id = ${part} AND x.relation = ${e.relation}
				)
			`);
			console.log(`  queued: ${name(e.from_id)} ${e.relation} ${name(part)}`);
		}
	}
	console.log('\nAll of the above are unapproved and waiting in the review queue.');
} else {
	console.log('\nDry run. --apply fixes 2 and 3; --merge-duplicates fixes 1.');
}

process.exit(0);
