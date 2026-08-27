/**
 * Close the gap between the ontology and what employers actually ask for.
 *
 * The other proposers start from the graph and look outward: `propose-skill-relations`
 * takes concepts that already exist and asks an LLM how they relate. That can
 * only ever enrich what is already in there. It cannot notice that Terraform is
 * the single most-requested skill in the corpus, because Terraform was never a
 * candidate — nothing put it on the list.
 *
 * This script starts from the other end: rank every skill string in
 * `jobs.skills_required` + `skills_preferred` by how often it is asked for,
 * subtract everything the graph already resolves, and look at what is left. No
 * LLM — the mapping below is a human reading of that list, which is the only
 * part that needed judgement.
 *
 *   docker compose exec -T app npx tsx scripts/propose-corpus-gaps.ts [--apply]
 *
 * Without `--apply` it measures, prints the batch and touches nothing.
 *
 * ## Two different gaps, and they are not the same fix
 *
 * Reading the top of the uncovered list, roughly half of it is not missing
 * knowledge at all — the concept is there under another name. `terraform` (136
 * mentions) missed `terraformiac`, since renamed; `go` (125) misses `golang`; `ci/cd pipelines`
 * (105) misses `cicd`. Those want an ALIAS: same concept, different spelling,
 * no new structure, and `expandUpward` seeds from alias as well as slug so they
 * inherit the whole existing chain for free.
 *
 * The other half is genuinely absent — Kafka, Databricks, Angular, Figma, dbt,
 * Airflow. Those want a CONCEPT plus one `broader` edge to hang it on.
 *
 * Getting this split wrong in the easy direction is expensive: an alias makes
 * one concept answer for the other everywhere, in both directions, with no
 * traversal to inspect. So "Web application" is staged as a concept under Web
 * development rather than as an alias of it — a web application is a thing you
 * build, web development is the activity, and they are not interchangeable even
 * though a job posting means the second when it writes the first.
 *
 * ## Nothing here approves anything
 *
 * Concepts are written directly, because a concept with no edges is inert — it
 * matches its own name and nothing else, which is exactly what the 29 isolated
 * concepts already in the graph do. Relations and aliases land with
 * `approved_at` null and are invisible to matching until promoted:
 *
 *   npx tsx scripts/approve-skill-relations.ts --source corpus-gap   # the 16 edges
 *   npx tsx scripts/approve-skill-relations.ts --aliases             # list, then --approve <id…>
 *
 * The two doors are not symmetric, and that is deliberate on the approver's
 * side: edges promote in a batch by source, aliases only by explicit id,
 * because an alias makes one concept answer for another in both directions at
 * once and there is no traversal left to inspect afterwards. Undo the edges
 * with `--revoke-source corpus-gap`.
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
const SOURCE = 'corpus-gap';

/**
 * Surface forms of concepts the graph already holds.
 *
 * `alias` is written as it appears in postings; `normalizeSkill` is applied
 * before it is stored, so "CI/CD pipelines" and "ci/cd pipelines" are one row.
 */
const ALIASES: { alias: string; concept: string; why: string }[] = [
	{ alias: 'go', concept: 'golang', why: 'the language, written both ways' },
	{ alias: 'ci/cd pipelines', concept: 'cicd', why: 'pluralised activity, same concept' },
	{ alias: 'artificial intelligence', concept: 'ai', why: 'expanded acronym' },
	{ alias: 'llms', concept: 'llm', why: 'plural' },
	{ alias: 'communication', concept: 'communicative', why: 'noun form of the stored adjective' }
];

/**
 * Concepts the graph does not have, each with the one parent that licenses an
 * upward match. One edge apiece on purpose — a second parent is a second claim,
 * and this batch is already large enough to review honestly.
 */
const CONCEPTS: { slug: string; label: string; broader: string }[] = [
	{ slug: 'apiintegration', label: 'API integration', broader: 'apis' },
	{ slug: 'databricks', label: 'Databricks', broader: 'dataprocessing' },
	{ slug: 'dataanalysis', label: 'Data analysis', broader: 'analytics' },
	{ slug: 'angular', label: 'Angular', broader: 'javascriptframework' },
	{ slug: 'kafka', label: 'Apache Kafka', broader: 'messagequeues' },
	{ slug: 'excel', label: 'Excel', broader: 'office' },
	{ slug: 'powerbi', label: 'Power BI', broader: 'analytics' },
	{ slug: 'r', label: 'R', broader: 'programminglanguages' },
	{ slug: 'spark', label: 'Apache Spark', broader: 'dataprocessing' },
	{ slug: 'figma', label: 'Figma', broader: 'designtools' },
	{ slug: 'dbt', label: 'dbt', broader: 'etl' },
	{ slug: 'azuredevops', label: 'Azure DevOps', broader: 'cicd' },
	{ slug: 'rust', label: 'Rust', broader: 'programminglanguages' },
	{ slug: 'tableau', label: 'Tableau', broader: 'analytics' },
	{ slug: 'webapplication', label: 'Web application', broader: 'webdevelopment' },
	{ slug: 'airflow', label: 'Apache Airflow', broader: 'etl' }
];

/**
 * Frequent, uncovered, and deliberately left out: `sales` (63), `customer
 * support` (57), `finance` (54). They are real skills and the corpus is not
 * purely an engineering one, but the graph's parents are all technical, so
 * there is nothing above them to reach. A concept with no honest parent is an
 * isolated node, and the graph has 29 of those already.
 */

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
 * covered" and "what this batch would add" cannot drift apart — they are the
 * same question asked twice.
 */
const KNOWN = sql`
	SELECT slug AS k FROM skill_concepts
	UNION SELECT regexp_replace(lower(label), '[^a-z0-9+#]', '', 'g') FROM skill_concepts
	UNION SELECT alias FROM skill_aliases WHERE approved_at IS NOT NULL
`;

/**
 * Share of skill MENTIONS the graph can resolve — not share of distinct
 * strings, which is the flattering number. Skill mentions are Zipf-distributed:
 * 276 concepts cover 2.6% of the distinct strings and roughly a third of what
 * is actually being asked for, and it is the second number that decides whether
 * a match happens.
 */
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
 * `NOT IN known` is what makes a second run honest. The two lists below are
 * hand-written constants, so they say the same thing forever, and without this
 * filter an already-applied batch reports its full gain again — a re-run after
 * approving read "35.4% → 40.4%" when 35.4% was the number the batch had just
 * produced. Filtering against the same `known` set `coverage()` uses means the
 * projection can only ever count what is still missing, and a fully-applied
 * batch correctly projects nothing.
 */
async function batchMentions(): Promise<Map<string, number>> {
	const keys = [...ALIASES.map((a) => normalizeSkill(a.alias)), ...CONCEPTS.map((c) => c.slug)];
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

	// A missing parent is a silent no-op — the concept lands, the edge does not,
	// and the batch reports success. Check before writing anything.
	const parents = [...new Set(CONCEPTS.map((c) => c.broader))];
	const targets = [...new Set([...parents, ...ALIASES.map((a) => a.concept)])];
	const found = await queryRawDirect<{ slug: string }>(
		sql`SELECT slug FROM skill_concepts WHERE slug IN (${inList(targets)})`
	);
	const missing = targets.filter((t) => !found.some((f) => f.slug === t));
	if (missing.length > 0) {
		console.error(`Refusing to run — these targets are not in the graph: ${missing.join(', ')}`);
		process.exit(1);
	}

	console.log(`Coverage now: ${before.pct.toFixed(1)}% of ${before.total} skill mentions.\n`);

	console.log(`Aliases (${ALIASES.length}) — concept exists under another name:`);
	for (const a of ALIASES) {
		const n = mentions.get(normalizeSkill(a.alias)) ?? 0;
		console.log(`  ${String(n).padStart(4)}  "${a.alias}" → ${a.concept}   (${a.why})`);
	}

	console.log(`\nConcepts (${CONCEPTS.length}) — new, each with one broader edge:`);
	for (const c of CONCEPTS) {
		const n = mentions.get(c.slug) ?? 0;
		console.log(`  ${String(n).padStart(4)}  ${c.label} —broader→ ${c.broader}`);
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

	for (const c of CONCEPTS) {
		await db.execute(
			sql`INSERT INTO skill_concepts (slug, label) VALUES (${c.slug}, ${c.label})
			    ON CONFLICT (slug) DO NOTHING`
		);
	}

	let edges = 0;
	for (const c of CONCEPTS) {
		const res = await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
			SELECT f.id, t.id, 'broader', 1.0, ${SOURCE}
			FROM skill_concepts f, skill_concepts t
			WHERE f.slug = ${c.slug} AND t.slug = ${c.broader}
			ON CONFLICT DO NOTHING
		`);
		edges += res.rowCount ?? 0;
	}

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
		`\nWrote ${CONCEPTS.length} concepts, ${edges} UNAPPROVED relations, ` +
			`${aliased} UNAPPROVED aliases (source "${SOURCE}").`
	);
	console.log('Nothing influences matching until approved:');
	console.log(`  npx tsx scripts/approve-skill-relations.ts --source ${SOURCE}`);
	console.log('  npx tsx scripts/approve-skill-relations.ts --aliases   # then --approve <id…>');
	process.exit(0);
}

await main();
