/**
 * The four decisions the 2026-08-30 audit left open, applied.
 *
 * Companion to `fix-ontology-audit.ts`, which handled the rows that were simply
 * wrong. Everything here was a judgement rather than a repair, so it waited for
 * a person to make it. The reasoning per group is on the group.
 *
 * Rejects rather than retires throughout, including the `inDomain` rows. Those
 * are not false claims — "React is in the IT domain" is true — but the claim
 * being ruled on is "this node needs its OWN domain edge", and under the
 * restored category rule that is false. Retiring would drop them back into the
 * review queue to be re-answered forever; the proposer's new directional filter
 * does not cover `inDomain`.
 *
 *   docker compose exec -T app npx tsx scripts/fix-ontology-decisions.ts
 *   docker compose exec -T app npx tsx scripts/fix-ontology-decisions.ts --apply
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';

const APPLY = process.argv.includes('--apply');

/** [id, from, relation, to, why] — labels are asserted, not decoration. */
type Reject = [number, string, string, string, string];

/**
 * `related` that is real association rather than interchangeable alternative.
 *
 * The bar is the one recorded on 2026-08-29: approve only where a posting could
 * name either and mean the same thing. These are the other half — a tool and the
 * thing it is used on, two halves of one stack, a framework and the language it
 * is written in. `relatedTo()` renders them as "you don't have this, but you
 * have X, which is related", and "you don't have Kubernetes, but you have DevOps"
 * is not a sentence worth showing anyone.
 *
 * Not decided structurally: fourteen of these are two children of one approved
 * parent, and so are the fifteen that survive, because that is exactly what an
 * alternative looks like. Each was read.
 */
const CO_OCCURRENCE: Reject[] = [
	[1248, 'Backend development', 'related', 'Frontend development', 'opposites, not alternatives'],
	[1372, 'Caching strategies', 'related', 'Scalability', 'means and end'],
	[1328, 'CI/CD', 'related', 'Containerization', 'used together'],
	[1367, 'CI/CD', 'related', 'Unit / Integration Testing', 'used together'],
	[1304, 'CI/CD', 'related', 'Git', 'used together'],
	[1301, 'Containerization', 'related', 'Deployment', 'means and end'],
	[1317, 'CRM', 'related', 'Marketing', 'used together'],
	[1316, 'E-commerce', 'related', 'Marketing', 'used together'],
	[1220, 'Embeddings', 'related', 'Vector Stores', 'a thing and where it is stored'],
	[1231, 'ETL', 'related', 'SQL', 'used together'],
	[1331, 'GraphQL', 'related', 'JSON', 'a protocol and its wire format'],
	[1296, 'GraphRAG', 'related', 'Knowledge Graphs', 'near-implication, not alternative'],
	[1262, 'HTML5', 'related', 'JavaScript', 'used together'],
	[1344, 'Jira', 'related', 'Scrum/Agile', 'a tool and the method it tracks'],
	[1245, 'Kubernetes', 'related', 'DevOps', 'a tool and the practice'],
	[1327, 'Microservices', 'related', 'Containerization', 'used together'],
	[1332, 'NoSQL', 'related', 'JSON', 'a store and its document format'],
	[1251, 'OAuth', 'related', 'RESTful API', 'used together'],
	[1275, 'React', 'related', 'Redux', 'a library and its host framework'],
	[1325, 'React Native', 'related', 'TypeScript', 'a framework and a language'],
	[814, 'Redis', 'related', 'Caching strategies', 'a tool and the practice'],
	[1219, 'Retrieval systems', 'related', 'Vector Stores', 'a system and its store'],
	[1221, 'Retrieval Techniques', 'related', 'Vector Stores', 'a technique and its store'],
	[1329, 'Scalability', 'related', 'Containerization', 'means and end'],
	[1376, 'Svelte', 'related', 'TypeScript', 'a framework and a language'],
	[1024, 'Svelte', 'related', 'Node.js', 'a framework and its runtime'],
	[1377, 'SvelteKit', 'related', 'TypeScript', 'a framework and a language'],
	[1324, 'Svelte / SvelteKit', 'related', 'TypeScript', 'a framework and a language'],
	[1278, 'Vercel', 'related', 'Svelte', 'a host and what it hosts'],
	[1279, 'Vercel', 'related', 'Svelte / SvelteKit', 'a host and what it hosts'],
	[1235, 'Vercel', 'related', 'Next.js', 'a host and what it hosts']
];

/**
 * A language is not a discipline.
 *
 * These licensed "has written Python" to answer a posting asking for backend
 * development, and a data scientist writes Python. Each concept keeps
 * `broader Programming languages`, which is the claim that is actually true.
 *
 * NOT included, and still open: `APIs broader Backend development` and
 * `Machine Learning broader Data Science`. Those are the same shape but a
 * weaker version of it — API work really is backend work — and they are why
 * `Prompt design` still reaches both.
 */
const LANGUAGE_AS_DISCIPLINE: Reject[] = [
	[994, 'Python', 'broader', 'Backend development', 'keeps Programming languages'],
	[725, 'Java', 'broader', 'Backend development', 'keeps Programming languages'],
	[20, 'PHP', 'broader', 'Backend development', 'keeps Programming languages'],
	[998, 'TypeScript', 'broader', 'Backend development', 'keeps JavaScript, Programming languages'],
	[21, 'MongoDB', 'broader', 'Backend development', 'keeps NoSQL, Distributed systems'],
	[
		4,
		'JavaScript',
		'broader',
		'Frontend development',
		'keeps Programming languages; already tagged audit:not-implication'
	]
];

/**
 * `inDomain` restored to what its docstring says it is: a CATEGORY rooted under
 * a domain, not every concept tagged individually.
 *
 * The rule applied is the one the docstring implies — a node needs its own
 * domain edge only when nothing above it has one. Computed, not judged: retire
 * where an ancestor still carries a domain, keep where the node is a matching
 * root. That leaves 23 edges on 22 nodes, every one of them a discipline or
 * category with no parent, and takes `IT` from degree 79 to 23.
 *
 * Nothing here changes matching — `inDomain` is drawn and never walked. It
 * changes the picture, which is the only thing the relation was ever for.
 */
const INDOMAIN_REDUNDANT: Reject[] = [
	[596, 'Agile', 'inDomain', 'IT', 'climbs to Project management'],
	[521, 'Agile methodologies', 'inDomain', 'IT', 'climbs to Agile'],
	[462, 'AI / LLM integrations', 'inDomain', 'IT', 'climbs to AI'],
	[742, 'AI coding tools', 'inDomain', 'IT', 'climbs to AI'],
	[446, 'AI-Assisted Development', 'inDomain', 'IT', 'climbs to Software development'],
	[592, 'API development', 'inDomain', 'IT', 'climbs to APIs'],
	[497, 'APIs', 'inDomain', 'IT', 'climbs to Backend development'],
	[487, 'Authentication', 'inDomain', 'IT', 'climbs to Security'],
	[410, 'AWS', 'inDomain', 'IT', 'climbs to Cloud platforms'],
	[801, 'Build tools', 'inDomain', 'IT', 'climbs to Developer tools'],
	[491, 'CI/CD', 'inDomain', 'IT', 'climbs to DevOps'],
	[767, 'Cloud services', 'inDomain', 'IT', 'climbs to Cloud platforms'],
	[505, 'Container orchestration', 'inDomain', 'IT', 'climbs to Containerization'],
	[803, 'Content Management Systems', 'inDomain', 'IT', 'climbs to Web development'],
	[608, 'CSS', 'inDomain', 'IT', 'climbs to Frontend development'],
	[432, 'Developer tools', 'inDomain', 'IT', 'climbs to Software development'],
	[519, 'Distributed systems', 'inDomain', 'IT', 'climbs to Software Architecture'],
	[783, 'E-commerce platforms', 'inDomain', 'IT', 'climbs to E-commerce'],
	[789, 'Embedded databases', 'inDomain', 'IT', 'climbs to Databases'],
	[454, 'End-to-end testing', 'inDomain', 'IT', 'climbs to Testing'],
	[692, 'Frontend development', 'inDomain', 'IT', 'climbs to Web development'],
	[723, 'Hosting services', 'inDomain', 'IT', 'climbs to Cloud platforms'],
	[501, 'HTML', 'inDomain', 'IT', 'climbs to Frontend development'],
	[472, 'Infrastructure as Code', 'inDomain', 'IT', 'climbs to Developer tools'],
	[757, 'Integrated Development Environments', 'inDomain', 'IT', 'climbs to Developer tools'],
	[856, 'JavaScript', 'inDomain', 'IT', 'climbs to Frontend development'],
	[466, 'JavaScript framework', 'inDomain', 'IT', 'climbs to JavaScript'],
	[748, 'Knowledge Graphs', 'inDomain', 'IT', 'climbs to Data modeling'],
	[442, 'Knowledge representation', 'inDomain', 'IT', 'climbs to AI'],
	[771, 'LLM APIs', 'inDomain', 'IT', 'climbs to APIs'],
	[478, 'Machine Learning', 'inDomain', 'IT', 'climbs to AI'],
	[437, 'Message queues', 'inDomain', 'IT', 'climbs to Distributed systems'],
	[781, 'Monitoring', 'inDomain', 'IT', 'climbs to Observability'],
	[509, 'NoSQL', 'inDomain', 'IT', 'climbs to Databases'],
	[515, 'Observability', 'inDomain', 'IT', 'climbs to DevOps'],
	[1423, 'Observability framework', 'inDomain', 'IT', 'climbs to Observability'],
	[418, 'Programming languages', 'inDomain', 'IT', 'climbs to Software development'],
	[513, 'Python', 'inDomain', 'IT', 'climbs to Backend development'],
	[499, 'RAG pipelines', 'inDomain', 'IT', 'climbs to Retrieval Augmented Generation'],
	[511, 'React', 'inDomain', 'IT', 'climbs to Frontend development'],
	[811, 'Scalable architecture', 'inDomain', 'IT', 'climbs to Software Architecture'],
	[489, 'Shell scripting', 'inDomain', 'IT', 'climbs to Backend development'],
	[493, 'Software Architecture', 'inDomain', 'IT', 'climbs to System Design'],
	[450, 'Software Design', 'inDomain', 'IT', 'climbs to Software development'],
	[769, 'Software development processes', 'inDomain', 'IT', 'climbs to Software development'],
	[698, 'SQL', 'inDomain', 'IT', 'climbs to Data query languages'],
	[523, 'SQL optimization', 'inDomain', 'IT', 'climbs to Software Design'],
	[602, 'System Design', 'inDomain', 'IT', 'climbs to Software Design'],
	[503, 'Template engines', 'inDomain', 'IT', 'climbs to Developer tools'],
	[573, 'Testing', 'inDomain', 'IT', 'climbs to Software development'],
	[604, 'Unit / Integration Testing', 'inDomain', 'IT', 'climbs to Testing'],
	[807, 'User Interfaces', 'inDomain', 'IT', 'climbs to UXD'],
	[868, 'UXD', 'inDomain', 'IT', 'climbs to Design'],
	[495, 'Web analytics', 'inDomain', 'IT', 'climbs to Analytics'],
	[765, 'Web development', 'inDomain', 'IT', 'climbs to Software development'],
	[713, 'Web frameworks', 'inDomain', 'IT', 'climbs to Web development'],
	[475, 'Web servers', 'inDomain', 'IT', 'climbs to Backend development']
];

/**
 * Concepts the extractor produced that are not skills.
 *
 * Deleting cascades to aliases and relations, so each was checked first: none is
 * referenced by any profile skill (`tech_skills.concept_id` is NULL everywhere),
 * none carries an approved relation, and the five relations that do exist are
 * already rejected. The list is here rather than in a WHERE clause so that
 * putting one back is a matter of reading it.
 *
 * The Dutch entries are whole sentences from job postings. "WO werk- en
 * denkniveau" is an education level. The adjectives are the soft-skill half of a
 * CV, which this vocabulary does not model and should not pretend to.
 */
const DELETE_CONCEPTS: [number, string, string][] = [
	[34, 'Analytical', 'soft-skill adjective'],
	[152, 'Communicative', 'soft-skill adjective'],
	[47, 'Creative', 'soft-skill adjective'],
	[217, 'Emphatic', 'soft-skill adjective, and a misspelling of "empathic"'],
	[40, 'Positive', 'soft-skill adjective'],
	[199, 'Results-oriented', 'soft-skill adjective'],
	[96, 'Service-oriented', 'soft-skill adjective'],
	[
		89,
		'Uitstekende beheersing van de Nederlandse taal',
		'a Dutch sentence; the concept "Dutch" already exists'
	],
	[109, 'Politiek-bestuurlijke sensitiviteit', 'a Dutch posting phrase'],
	[162, 'Automatiseringstechnologieën', 'a Dutch posting phrase'],
	[112, 'WO werk- en denkniveau (WO-master)', 'an education level, not a skill'],
	[180, 'Packages', 'fragment'],
	[142, 'Enquiries', 'fragment'],
	[36, 'Delta', 'fragment — ambiguous between Delta Lake, the airline and the letter']
];

/**
 * Two repairs that keep every surface form resolvable.
 *
 * A concept is deleted only where nothing should resolve to it. These two are
 * the opposite case: the string a person typed is fine, the row behind it was
 * not. So the old slug survives as an alias and `expandUpward`, which seeds from
 * slug AND alias, keeps answering it.
 */
const MERGE_INTO: [number, string, number, string, string][] = [
	// [deadId, deadLabel, keepId, keepLabel, aliasToAdd]
	[946, 'Recursive CTEs', 126, 'Recursive Common Table Expressions', 'recursivectes']
];

const RENAME: [number, string, string, string, string][] = [
	// [id, fromLabel, toLabel, toSlug, keepOldSlugAsAlias]
	[155, 'Mendrix', 'Mendix', 'mendix', 'mendrix']
];

interface Row {
	id: number;
	from_label: string;
	to_label: string;
	relation: string;
	rejected: boolean;
}

let rejected = 0;
let changed = 0;
const problems: string[] = [];

async function rejectGroup(title: string, group: Reject[]) {
	console.log(`\n── ${title} (${group.length})`);
	if (group.length === 0) return;
	const rows = await queryRawDirect<Row>(sql`
		SELECT r.id, r.relation, f.label AS from_label, t.label AS to_label,
		       (r.rejected_at IS NOT NULL) AS rejected
		FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE r.id IN (${sql.join(
			group.map((g) => sql`${g[0]}`),
			sql`, `
		)})
	`);
	const byId = new Map(rows.map((r) => [r.id, r]));
	for (const [id, from, relation, to, why] of group) {
		const row = byId.get(id);
		if (!row) {
			problems.push(`#${id} not found`);
			console.log(`  SKIP #${id} — no such row`);
			continue;
		}
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

async function labelOf(id: number): Promise<string | null> {
	const rows = await queryRawDirect<{ label: string }>(
		sql`SELECT label FROM skill_concepts WHERE id = ${id}`
	);
	return rows[0]?.label ?? null;
}

async function mergeAndRename() {
	console.log(`\n── merge duplicates (${MERGE_INTO.length})`);
	for (const [deadId, deadLabel, keepId, keepLabel, alias] of MERGE_INTO) {
		const dead = await labelOf(deadId);
		const keep = await labelOf(keepId);
		if (dead === null && keep === keepLabel) {
			console.log(`  already merged  ${deadLabel} → ${keepLabel}`);
			continue;
		}
		if (dead !== deadLabel || keep !== keepLabel) {
			problems.push(`merge target moved: #${deadId} is "${dead}", #${keepId} is "${keep}"`);
			console.log(`  SKIP ${deadLabel} → ${keepLabel} — label mismatch`);
			continue;
		}
		if (APPLY) {
			// The alias first: if the delete succeeded and this did not, the surface
			// form would resolve to nothing, which is worse than the duplicate.
			await db.execute(sql`
				INSERT INTO skill_aliases (concept_id, alias, source, approved_at)
				VALUES (${keepId}, ${alias}, 'audit:merge', now())
				ON CONFLICT (alias) DO UPDATE SET concept_id = ${keepId}, approved_at = now()
			`);
			await db.execute(sql`DELETE FROM skill_concepts WHERE id = ${deadId}`);
		}
		changed++;
		console.log(`  merge  "${deadLabel}" → "${keepLabel}", keeping "${alias}" as an alias`);
	}

	console.log(`\n── rename (${RENAME.length})`);
	for (const [id, fromLabel, toLabel, toSlug, oldSlug] of RENAME) {
		const cur = await labelOf(id);
		if (cur === toLabel) {
			console.log(`  already renamed #${id}  ${toLabel}`);
			continue;
		}
		if (cur !== fromLabel) {
			problems.push(`rename target moved: #${id} is "${cur}", expected "${fromLabel}"`);
			console.log(`  SKIP #${id} — label mismatch`);
			continue;
		}
		if (APPLY) {
			await db.execute(sql`
				INSERT INTO skill_aliases (concept_id, alias, source, approved_at)
				VALUES (${id}, ${oldSlug}, 'audit:rename', now())
				ON CONFLICT (alias) DO UPDATE SET concept_id = ${id}, approved_at = now()
			`);
			await db.execute(
				sql`UPDATE skill_concepts SET label = ${toLabel}, slug = ${toSlug} WHERE id = ${id}`
			);
		}
		changed++;
		console.log(`  rename #${id}  "${fromLabel}" → "${toLabel}", keeping "${oldSlug}" as an alias`);
	}
}

async function deleteConcepts() {
	console.log(`\n── delete non-skills (${DELETE_CONCEPTS.length})`);
	for (const [id, label, why] of DELETE_CONCEPTS) {
		const cur = await labelOf(id);
		if (cur === null) {
			console.log(`  already gone #${id}  ${label}`);
			continue;
		}
		if (cur !== label) {
			problems.push(`#${id} is "${cur}", expected "${label}"`);
			console.log(`  SKIP #${id} — label mismatch`);
			continue;
		}
		// Refuse to delete anything the graph or a profile actually uses. The list
		// was checked by hand once; this makes it check itself every run.
		const held = await queryRawDirect<{ approved: number; used: number }>(sql`
			SELECT
				(SELECT count(*)::int FROM skill_relations r
				 WHERE (r.from_id = ${id} OR r.to_id = ${id}) AND r.approved_at IS NOT NULL) AS approved,
				(SELECT count(*)::int FROM tech_skills t WHERE t.concept_id = ${id}) AS used
		`);
		const { approved, used } = held[0];
		if (approved > 0 || used > 0) {
			problems.push(
				`#${id} "${label}" has ${approved} approved edge(s) and ${used} use(s) — not deleted`
			);
			console.log(`  SKIP #${id} ${label} — in use`);
			continue;
		}
		if (APPLY) await db.execute(sql`DELETE FROM skill_concepts WHERE id = ${id}`);
		changed++;
		console.log(`  delete #${id}  ${label}  — ${why}`);
	}
}

console.log(APPLY ? 'APPLYING' : 'DRY RUN — nothing is written');

await rejectGroup('related — association, not alternative', CO_OCCURRENCE);
await rejectGroup('a language is not a discipline', LANGUAGE_AS_DISCIPLINE);
await rejectGroup('inDomain — an ancestor already carries the domain', INDOMAIN_REDUNDANT);
await mergeAndRename();
await deleteConcepts();

console.log(
	`\n${APPLY ? 'applied' : 'would apply'}: ${rejected} rejected, ${changed} concept changes`
);
if (problems.length > 0) {
	console.log(`\n${problems.length} problem(s):`);
	for (const p of problems) console.log(`  ! ${p}`);
	process.exit(1);
}
process.exit(0);
