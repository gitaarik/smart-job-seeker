/**
 * Mint the compound skill entries employers write but the graph has never seen.
 *
 * `propose-skill-splits.ts` reconciles compounds that are ALREADY concepts — it
 * reads `skill_concepts`, enumerates readings with `splitCompoundSkill`, and
 * writes `covers` edges to the parts. That works, and the five it has done are
 * live: "Svelte / SvelteKit" reaches Svelte, SvelteKit and every ancestor of
 * both.
 *
 * It cannot see a compound that was never minted. `ai/ml` is asked for 22 times
 * and `ui/ux design` 19, and neither is a concept, so neither is a candidate —
 * the same blind spot `propose-corpus-gaps.ts` was written for, one shape down.
 * This script starts from the corpus instead and stages what is missing.
 *
 *   docker compose exec -T app npx tsx scripts/propose-corpus-compounds.ts [--apply]
 *
 * Without `--apply` it measures, prints the batch and touches nothing.
 *
 * ## Three shapes, because a slash means three different things
 *
 * **A compound naming two skills** — `html/css`, `c/c++`, `etl/elt`. These get a
 * concept plus one `covers` edge per part, which is the shape the existing five
 * use. Some parts are themselves missing (C, C++, ELT, Unix, UI design, UX
 * design), so they are minted first with a `broader` edge of their own; a
 * `covers` edge to a concept that does not exist is a silent no-op.
 *
 * **A false compound, where the slash is part of the name** — `a/b testing`,
 * and `ci/cd` before it. Splitting these is wrong: there is no skill called "A"
 * satisfied by half of A/B testing. They get one plain concept and one
 * `broader` edge, exactly like any other missing skill. `propose-skill-splits`
 * already refuses to split `CI/CD` and `GitLab CI/CD` for this reason; the
 * judgement is the same one, made here before the concept exists rather than
 * after.
 *
 * **A spelling of something already covered** — `ux/ui`, `ui/ux`, `ci/cd
 * systems`, `ai/ml workflows`. Alias, no new structure.
 *
 * ## What this does NOT fix, and it is the more common direction
 *
 * Matching expands the PROFILE and compares exactly, so minting `HTML/CSS`
 * helps an applicant who wrote the compound. It does nothing for a JOB that
 * wrote it: the job's string is never expanded, so `html/css` still fails
 * against a profile listing HTML. `skill-ontology.ts` says so deliberately —
 * a compound in a posting is an either-will-do, and answering it means walking
 * `covers` DOWNWARD, which that module refuses to do because a downward
 * traversal is how the false positives got in last time.
 *
 * The counts below are job strings. So this batch makes the vocabulary correct
 * and leaves the frequent direction unanswered on purpose; the fix belongs in
 * the matcher, not in more rows.
 *
 * ## Nothing here approves anything
 *
 * Concepts are written directly, because a concept with no approved edge is
 * inert — it resolves a string and implies nothing. Every `covers`, every
 * `broader` and every alias is staged UNAPPROVED for
 * `approve-skill-relations.ts`, which checks each row against the graph as it
 * promotes.
 */
import { sql, type SQL } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { normalizeSkill } from '../src/lib/skills';

/**
 * A parameterised `IN (…)` list — the same workaround `skill-ontology.ts`
 * carries, and for the same reason: drizzle interpolates a JS array as a
 * placeholder list rather than a Postgres array literal, so `= ANY(${arr})`
 * fails with "op ANY/ALL (array) requires array on right side". Private there,
 * so copied rather than imported.
 */
function inList(values: string[]): SQL {
	return sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	);
}

const APPLY = process.argv.includes('--apply');
const SOURCE = 'corpus-compound';

/**
 * Parts that have to exist before anything can `covers` them.
 *
 * Each is a real skill in its own right that happened to reach the corpus only
 * inside a compound — the same way SvelteKit and Vitest did. UI and UX are
 * deliberately written as "UI design" / "UX design" rather than the bare
 * initialisms: the corpus writes "ui/ux design", where the writer factored out
 * a shared tail, and two-letter concepts are a poor thing to have in a
 * vocabulary matched by substring on the retrieval path.
 */
const PARTS: { slug: string; label: string; broader: string }[] = [
	{ slug: 'c', label: 'C', broader: 'programminglanguages' },
	{ slug: 'c++', label: 'C++', broader: 'programminglanguages' },
	{ slug: 'elt', label: 'ELT', broader: 'datascience' },
	{ slug: 'unix', label: 'Unix', broader: 'operatingsystems' },
	{ slug: 'uidesign', label: 'UI design', broader: 'design' },
	{ slug: 'uxdesign', label: 'UX design', broader: 'design' }
];

/**
 * Compounds naming two skills: one concept, one `covers` edge per part.
 *
 * `covers` rather than `broader` because this is not a hierarchy — "HTML/CSS"
 * is not a kind of HTML, it is one entry claiming both. It licenses the same
 * upward inference, which is why the three matching relations compose in a
 * single traversal without the query knowing which is which.
 */
const COMPOUNDS: { slug: string; label: string; covers: string[] }[] = [
	{ slug: 'aiml', label: 'AI/ML', covers: ['ai', 'machinelearning'] },
	{ slug: 'uiuxdesign', label: 'UI/UX design', covers: ['uidesign', 'uxdesign'] },
	{ slug: 'cc++', label: 'C/C++', covers: ['c', 'c++'] },
	{
		slug: 'javascripttypescript',
		label: 'JavaScript/TypeScript',
		covers: ['javascript', 'typescript']
	},
	{ slug: 'etlelt', label: 'ETL/ELT', covers: ['etl', 'elt'] },
	{ slug: 'htmlcss', label: 'HTML/CSS', covers: ['html', 'css'] },
	{
		slug: 'langchainlanggraph',
		label: 'LangChain/LangGraph',
		covers: ['langchain', 'langgraph']
	},
	{ slug: 'unixlinux', label: 'Unix/Linux', covers: ['unix', 'linux'] }
];

/**
 * Strings that look compound and are not. The slash is part of one name, so
 * they take a plain `broader` edge like any other missing concept.
 *
 * `tcp/ip` (18 mentions) belongs in this list and is not in it: it wants a
 * `Networking` parent, the graph has none, and inventing a top-level domain to
 * hang one string on is a larger decision than this batch. It is the first
 * candidate for the next single-concept run.
 *
 * A/B testing hangs under Analytics rather than Testing, which is the reading
 * the name invites and the wrong one. `Testing` in this graph is software QA —
 * Unit Testing and Integration Testing are its children — and A/B testing is an
 * experiment on users whose result is a measurement. Filing it under Testing
 * would license "has run an A/B test" ⇒ "has written tests", which is a claim
 * about a different job. Nothing at approve time catches a parent that is
 * merely wrong: the guards refuse cycles and clashes, not bad judgement.
 */
const PLAIN: { slug: string; label: string; broader: string }[] = [
	{ slug: 'abtesting', label: 'A/B testing', broader: 'analytics' }
];

/** Surface forms of something the batch (or the graph) already holds. */
const ALIASES: { alias: string; concept: string; why: string }[] = [
	{ alias: 'ml', concept: 'machinelearning', why: 'initialism for the concept' },
	{ alias: 'ai/ml workflows', concept: 'aiml', why: 'the compound plus a shared tail' },
	{ alias: 'ui/ux', concept: 'uiuxdesign', why: 'the same pair without the tail' },
	{ alias: 'ux/ui', concept: 'uiuxdesign', why: 'the same pair, written the other way round' },
	{ alias: 'ui/ux experience', concept: 'uiuxdesign', why: 'the same pair, prose tail' },
	{ alias: 'ci/cd systems', concept: 'cicd', why: 'pluralised activity, same concept' }
];

/** Every skill string in the corpus, with how often it is asked for. */
const CORPUS = sql`
	WITH m AS (
		SELECT lower(trim(s)) AS skill FROM jobs,
			LATERAL json_array_elements_text(skills_required) AS s
		WHERE json_typeof(skills_required) = 'array'
		UNION ALL
		SELECT lower(trim(s)) FROM jobs,
			LATERAL json_array_elements_text(skills_preferred) AS s
		WHERE json_typeof(skills_preferred) = 'array'
	)
	SELECT regexp_replace(skill, '[^a-z0-9+#]', '', 'g') AS key, count(*)::int AS n
	FROM m WHERE skill <> '' GROUP BY 1
`;

/**
 * Every string the graph can already resolve: a concept by slug, a concept by
 * its normalized label, and an APPROVED alias. Shared so that "what counts as
 * covered" and "what this batch would add" cannot drift apart.
 */
const KNOWN = sql`
	SELECT slug AS k FROM skill_concepts
	UNION SELECT regexp_replace(lower(label), '[^a-z0-9+#]', '', 'g') FROM skill_concepts
	UNION SELECT alias FROM skill_aliases WHERE approved_at IS NOT NULL
`;

/** Share of skill MENTIONS the graph can resolve. */
async function coverage(): Promise<{ pct: number; covered: number; total: number }> {
	const [row] = await queryRawDirect<{ covered: number; total: number }>(sql`
		WITH freq AS (${CORPUS}),
		known AS (${KNOWN})
		SELECT COALESCE(sum(n) FILTER (WHERE key IN (SELECT k FROM known)), 0)::int AS covered,
		       COALESCE(sum(n), 0)::int AS total
		FROM freq
	`);
	const { covered, total } = row ?? { covered: 0, total: 0 };
	return { pct: total ? (covered / total) * 100 : 0, covered, total };
}

/**
 * Mentions this batch would newly resolve, measured rather than assumed.
 *
 * Filtered against the same `known` set `coverage()` uses, so a re-run after
 * approving cannot re-count a batch it already applied — the lists above are
 * hand-written constants and say the same thing forever.
 */
async function batchMentions(): Promise<Map<string, number>> {
	const keys = [
		...PARTS.map((p) => p.slug),
		...COMPOUNDS.map((c) => c.slug),
		...PLAIN.map((p) => p.slug),
		...ALIASES.map((a) => normalizeSkill(a.alias))
	];
	const rows = await queryRawDirect<{ key: string; n: number }>(sql`
		WITH freq AS (${CORPUS}),
		known AS (${KNOWN})
		SELECT key, n FROM freq
		WHERE key IN (${inList(keys)}) AND key NOT IN (SELECT k FROM known)
	`);
	return new Map(rows.map((r) => [r.key, Number(r.n)]));
}

async function main(): Promise<void> {
	const before = await coverage();
	const mentions = await batchMentions();
	const gain = [...mentions.values()].reduce((a, b) => a + b, 0);

	// A missing target is a silent no-op — the concept lands, the edge does not,
	// and the batch reports success. Parts this run mints itself count as
	// present; anything else has to be in the graph already.
	const minted = new Set([
		...PARTS.map((p) => p.slug),
		...COMPOUNDS.map((c) => c.slug),
		...PLAIN.map((p) => p.slug)
	]);
	const targets = [
		...PARTS.map((p) => p.broader),
		...PLAIN.map((p) => p.broader),
		...COMPOUNDS.flatMap((c) => c.covers),
		...ALIASES.map((a) => a.concept)
	].filter((t) => !minted.has(t));
	const found = await queryRawDirect<{ slug: string }>(
		sql`SELECT slug FROM skill_concepts WHERE slug IN (${inList([...new Set(targets)])})`
	);
	const missing = [...new Set(targets)].filter((t) => !found.some((f) => f.slug === t));
	if (missing.length > 0) {
		console.error(`Refusing to run — these targets are not in the graph: ${missing.join(', ')}`);
		process.exit(1);
	}

	const n = (key: string): string => String(mentions.get(key) ?? 0).padStart(4);

	console.log(`Coverage now: ${before.pct.toFixed(1)}% of ${before.total} skill mentions.\n`);

	console.log(`Parts (${PARTS.length}) — minted so a covers edge has somewhere to land:`);
	for (const p of PARTS) console.log(`  ${n(p.slug)}  ${p.label} —broader→ ${p.broader}`);

	console.log(`\nCompounds (${COMPOUNDS.length}) — one entry naming two skills:`);
	for (const c of COMPOUNDS)
		console.log(`  ${n(c.slug)}  ${c.label} —covers→ ${c.covers.join(', ')}`);

	console.log(`\nNot compounds (${PLAIN.length}) — the slash is part of the name:`);
	for (const p of PLAIN) console.log(`  ${n(p.slug)}  ${p.label} —broader→ ${p.broader}`);

	console.log(`\nAliases (${ALIASES.length}) — a spelling of something already covered:`);
	for (const a of ALIASES) {
		console.log(`  ${n(normalizeSkill(a.alias))}  "${a.alias}" → ${a.concept}   (${a.why})`);
	}

	const after = before.total ? ((before.covered + gain) / before.total) * 100 : 0;
	console.log(
		`\n${gain} mentions would newly resolve: ` +
			`${before.pct.toFixed(1)}% → ${after.toFixed(1)}% (+${(after - before.pct).toFixed(1)}pp).`
	);

	if (!APPLY) {
		console.log('\nDry run. Pass --apply to write concepts and UNAPPROVED relations/aliases.');
		process.exit(0);
	}

	// Parts before compounds: a `covers` edge whose target does not exist yet
	// inserts nothing and says nothing.
	for (const c of [...PARTS, ...PLAIN, ...COMPOUNDS]) {
		await db.execute(
			sql`INSERT INTO skill_concepts (slug, label) VALUES (${c.slug}, ${c.label})
			    ON CONFLICT (slug) DO NOTHING`
		);
	}

	let edges = 0;
	const edge = async (from: string, to: string, relation: string): Promise<void> => {
		const res = await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
			SELECT f.id, t.id, ${relation}, 1.0, ${SOURCE}
			FROM skill_concepts f, skill_concepts t
			WHERE f.slug = ${from} AND t.slug = ${to}
			ON CONFLICT DO NOTHING
		`);
		edges += res.rowCount ?? 0;
	};

	for (const p of [...PARTS, ...PLAIN]) await edge(p.slug, p.broader, 'broader');
	for (const c of COMPOUNDS) for (const part of c.covers) await edge(c.slug, part, 'covers');

	let aliased = 0;
	for (const a of ALIASES) {
		const alias = normalizeSkill(a.alias);
		if (!alias) continue;
		const res = await db.execute(sql`
			INSERT INTO skill_aliases (concept_id, alias, source)
			SELECT c.id, ${alias}, ${SOURCE}
			FROM skill_concepts c
			WHERE c.slug = ${a.concept}
			ON CONFLICT (alias) DO NOTHING
		`);
		aliased += res.rowCount ?? 0;
	}

	console.log(
		`\nWrote ${PARTS.length + PLAIN.length + COMPOUNDS.length} concepts, ` +
			`${edges} UNAPPROVED relations, ${aliased} UNAPPROVED aliases (source "${SOURCE}").`
	);
	console.log('Nothing influences matching until approved:');
	console.log(`  npx tsx scripts/approve-skill-relations.ts --source ${SOURCE}`);
	console.log('  npx tsx scripts/approve-skill-relations.ts --aliases   # then --approve <id…>');
	process.exit(0);
}

await main();
