/**
 * Stage the LLM-engineering vocabulary the graph was missing, found on
 * application 92 (2026-10-09).
 *
 *   docker compose exec -T worker npx dotenvx run --quiet -f .env -- \
 *     npx tsx oss/scripts/propose-llm-vocabulary.ts [--apply]
 *
 * Without `--apply` it prints the batch and touches nothing.
 *
 * ## What it found
 *
 * A job asking for "Large Language Models" and "AI Integration" credited none
 * of RAG, MCP, Embeddings or LLM evaluation through the graph. RAG's only edge
 * was a drawn `inDomain`, so it implied nothing; the profile writes "MCP" and
 * the concept is "MCP (Model Context Protocol)", with no alias between them and
 * no edges; nine of the applicant's AI names (Gemini, Prompt caching, Context
 * engineering and more) had no concept at all. On the posting's side "AI
 * Integration", "Software Testing" and "Information Security" resolved to
 * nothing, though the graph holds all three under other names. The matcher
 * still credited most of them, through its model-based pass, which tailoring's
 * evidence check cannot use and which can answer differently next time.
 *
 * `propose-corpus-terms.ts` covers the posting side in bulk and ran first; it
 * reaches only the 200 most-asked phrases, and these were below its cut. This
 * is the hand-written half, in the shape of `propose-corpus-gaps.ts`.
 *
 * ## Nothing here approves anything
 *
 * Concepts are written directly, for the reason `propose-corpus-gaps.ts` gives:
 * one with no approved edge answers its own name and nothing else. Edges and
 * aliases land unapproved, after the same refusals the review queue applies
 * (`refuseNewRelation`: no loop, no clash with an approved edge), and wait in
 * /admin/skill-ontology.
 *
 *   npx tsx scripts/approve-skill-relations.ts --source ai-vocabulary   # the edges
 *   npx tsx scripts/approve-skill-relations.ts --aliases                # then --approve <id…>
 */
import { sql, type SQL } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { normalizeSkill } from '../src/lib/skills';
import { refuseNewRelation } from '../src/lib/server/job/skill-relation-guards';

const APPLY = process.argv.includes('--apply');
const SOURCE = 'ai-vocabulary';

/** See propose-corpus-gaps.ts: drizzle cannot bind a JS array to `= ANY`. */
function inList(values: string[]): SQL {
	return sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	);
}

type Relation = 'broader' | 'requires';

/** Another name for a concept the graph already holds. */
const ALIASES: { alias: string; concept: string; why: string }[] = [
	{
		alias: 'MCP',
		concept: 'mcpmodelcontextprotocol',
		why: 'the acronym the profile and most postings write'
	},
	{
		alias: 'AI Integration',
		concept: 'aillmintegrations',
		why: 'integrating models into a product is what the concept names'
	},
	{ alias: 'Software Testing', concept: 'testing', why: 'the same activity, qualified' },
	{ alias: 'Information Security', concept: 'security', why: 'what InfoSec expands to' }
];

/** Concepts the graph does not have, each with the one edge that licenses an upward match. */
const CONCEPTS: { slug: string; label: string; relation: Relation; to: string }[] = [
	{ slug: 'gemini', label: 'Gemini', relation: 'broader', to: 'llmapis' },
	{ slug: 'promptcaching', label: 'Prompt caching', relation: 'requires', to: 'llmapis' },
	// Context engineering includes prompt design rather than being a kind of
	// it, so it requires it: no one curates a model's context without writing
	// prompts.
	{
		slug: 'contextengineering',
		label: 'Context engineering',
		relation: 'requires',
		to: 'promptdesign'
	},
	{ slug: 'humanintheloop', label: 'Human-in-the-loop', relation: 'broader', to: 'ai' },
	{ slug: 'langfuse', label: 'Langfuse', relation: 'broader', to: 'monitoring' },
	{
		slug: 'functioncalling',
		label: 'Function calling',
		relation: 'broader',
		to: 'llmintegrations'
	},
	{
		slug: 'structuredoutputs',
		label: 'Structured outputs',
		relation: 'broader',
		to: 'llmintegrations'
	},
	{ slug: 'semanticsearch', label: 'Semantic search', relation: 'requires', to: 'embeddings' }
];

/** Edges between concepts the graph already holds. */
const EDGES: { from: string; relation: Relation; to: string; why: string }[] = [
	{
		from: 'retrievalaugmentedgeneration',
		relation: 'requires',
		to: 'llm',
		why: 'the generation in RAG is a language model'
	},
	{
		from: 'mcpmodelcontextprotocol',
		relation: 'requires',
		to: 'llm',
		why: 'a protocol for giving a model tools and context'
	},
	{
		from: 'aiagents',
		relation: 'requires',
		to: 'llm',
		why: 'an agent in the sense postings mean is a model calling tools'
	},
	{ from: 'git', relation: 'broader', to: 'versioncontrol', why: 'Git is a version control system' }
];

async function idsOf(slugs: string[]): Promise<Map<string, number>> {
	const rows = await queryRawDirect<{ id: number; slug: string }>(
		sql`SELECT id, slug FROM skill_concepts WHERE slug IN (${inList(slugs)})`
	);
	return new Map(rows.map((r) => [r.slug, Number(r.id)]));
}

async function main(): Promise<void> {
	// A missing endpoint is a silent no-op: the edge would not land and the batch
	// would report success. Check before writing anything.
	const existing = [
		...new Set([
			...ALIASES.map((a) => a.concept),
			...CONCEPTS.map((c) => c.to),
			...EDGES.flatMap((e) => [e.from, e.to])
		])
	];
	const before = await idsOf(existing);
	const missing = existing.filter((slug) => !before.has(slug));
	if (missing.length > 0) {
		console.error(`Refusing to run: not in the graph: ${missing.join(', ')}`);
		process.exit(1);
	}
	const taken = await idsOf(CONCEPTS.map((c) => c.slug));
	const clashing = await queryRawDirect<{ alias: string }>(sql`
		SELECT alias FROM skill_aliases
		WHERE alias IN (${inList([...ALIASES.map((a) => normalizeSkill(a.alias)), ...CONCEPTS.map((c) => c.slug)])})
		UNION
		SELECT slug FROM skill_concepts WHERE slug IN (${inList(ALIASES.map((a) => normalizeSkill(a.alias)))})
	`);
	if (clashing.length > 0) {
		console.error(
			`Refusing to run: already a concept or an alias: ${clashing.map((c) => c.alias).join(', ')}`
		);
		process.exit(1);
	}

	console.log(`Aliases (${ALIASES.length}):`);
	for (const a of ALIASES) console.log(`  "${a.alias}" → ${a.concept}   (${a.why})`);
	console.log(`\nConcepts (${CONCEPTS.length}), each with one edge:`);
	for (const c of CONCEPTS) {
		console.log(
			`  ${c.label} —${c.relation}→ ${c.to}${taken.has(c.slug) ? '   (concept exists)' : ''}`
		);
	}
	console.log(`\nEdges between existing concepts (${EDGES.length}):`);
	for (const e of EDGES) console.log(`  ${e.from} —${e.relation}→ ${e.to}   (${e.why})`);

	if (!APPLY) {
		// The guard can only look at edges whose ends exist, which for the new
		// concepts is after --apply writes them.
		for (const e of EDGES) {
			const refusal = await refuseNewRelation(before.get(e.from)!, before.get(e.to)!, e.relation);
			if (refusal) console.log(`  would be refused: ${e.from} → ${e.to}: ${refusal.error}`);
		}
		console.log('\nDry run. Pass --apply to write concepts and UNAPPROVED relations/aliases.');
		process.exit(0);
	}

	for (const c of CONCEPTS) {
		await db.execute(
			sql`INSERT INTO skill_concepts (slug, label) VALUES (${c.slug}, ${c.label})
			    ON CONFLICT (slug) DO NOTHING`
		);
	}
	const ids = await idsOf([...existing, ...CONCEPTS.map((c) => c.slug)]);

	let edges = 0;
	const refused: string[] = [];
	const all = [
		...CONCEPTS.map((c) => ({ from: c.slug, relation: c.relation, to: c.to })),
		...EDGES
	];
	for (const e of all) {
		const from = ids.get(e.from)!;
		const to = ids.get(e.to)!;
		const refusal = await refuseNewRelation(from, to, e.relation);
		if (refusal) {
			refused.push(`${e.from} → ${e.to}: ${refusal.error}`);
			continue;
		}
		const res = await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
			VALUES (${from}, ${to}, ${e.relation}, 1.0, ${SOURCE})
			ON CONFLICT DO NOTHING
		`);
		edges += res.rowCount ?? 0;
	}

	let aliased = 0;
	for (const a of ALIASES) {
		const res = await db.execute(sql`
			INSERT INTO skill_aliases (concept_id, alias, source)
			VALUES (${ids.get(a.concept)!}, ${normalizeSkill(a.alias)}, ${SOURCE})
			ON CONFLICT (alias) DO NOTHING
		`);
		aliased += res.rowCount ?? 0;
	}

	console.log(
		`\nWrote ${CONCEPTS.length} concepts, ${edges} UNAPPROVED relations, ` +
			`${aliased} UNAPPROVED aliases (source "${SOURCE}").`
	);
	for (const r of refused) console.log(`  refused: ${r}`);
	console.log('Nothing influences matching until approved, in /admin/skill-ontology.');
	process.exit(0);
}

await main();
