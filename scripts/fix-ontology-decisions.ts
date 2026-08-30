/**
 * The four decisions the 2026-08-30 audit left open, applied.
 *
 * Companion to `fix-ontology-audit.ts`, which handled the rows that were simply
 * wrong. Everything here was a judgement rather than a repair, so it waited for
 * a person to make it. The reasoning per group is on the group.
 *
 * Rulings are addressed by SLUG so this replays on any environment; see
 * `lib/ontology-replay.ts`. Run it AFTER `fix-ontology-audit.ts` — the
 * `inDomain` group below assumes the hierarchy that pass leaves behind.
 *
 * Rejects rather than retires throughout, including the `inDomain` rows. Those
 * are not false claims — "React is in the IT domain" is true — but the claim
 * being ruled on is "this node needs its OWN domain edge", and under the
 * restored category rule that is false. Retiring would drop them back into the
 * review queue to be re-answered forever; the proposer's directional filter does
 * not cover `inDomain`.
 *
 *   docker compose exec -T app npx tsx scripts/fix-ontology-decisions.ts
 *   docker compose exec -T app npx tsx scripts/fix-ontology-decisions.ts --apply
 */
import {
	deleteConcepts,
	strandedBy,
	merge,
	mergeConcept,
	reject,
	renameConcept,
	report,
	snapshot,
	tally,
	type Ruling
} from './lib/ontology-replay';

const APPLY = process.argv.includes('--apply');

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
const CO_OCCURRENCE: Ruling[] = [
	['Backend development', 'related', 'Frontend development', 'opposites, not alternatives'],
	['Caching strategies', 'related', 'Scalability', 'means and end'],
	['CI/CD', 'related', 'Containerization', 'used together'],
	['CI/CD', 'related', 'Unit / Integration Testing', 'used together'],
	['CI/CD', 'related', 'Git', 'used together'],
	['Containerization', 'related', 'Deployment', 'means and end'],
	['CRM', 'related', 'Marketing', 'used together'],
	['E-commerce', 'related', 'Marketing', 'used together'],
	['Embeddings', 'related', 'Vector Stores', 'a thing and where it is stored'],
	['ETL', 'related', 'SQL', 'used together'],
	['GraphQL', 'related', 'JSON', 'a protocol and its wire format'],
	['GraphRAG', 'related', 'Knowledge Graphs', 'near-implication, not alternative'],
	['HTML5', 'related', 'JavaScript', 'used together'],
	['Jira', 'related', 'Scrum/Agile', 'a tool and the method it tracks'],
	['Kubernetes', 'related', 'DevOps', 'a tool and the practice'],
	['Microservices', 'related', 'Containerization', 'used together'],
	['NoSQL', 'related', 'JSON', 'a store and its document format'],
	['OAuth', 'related', 'RESTful API', 'used together'],
	['React', 'related', 'Redux', 'a library and its host framework'],
	['React Native', 'related', 'TypeScript', 'a framework and a language'],
	['Redis', 'related', 'Caching strategies', 'a tool and the practice'],
	['Retrieval systems', 'related', 'Vector Stores', 'a system and its store'],
	['Retrieval Techniques', 'related', 'Vector Stores', 'a technique and its store'],
	['Scalability', 'related', 'Containerization', 'means and end'],
	['Svelte', 'related', 'TypeScript', 'a framework and a language'],
	['Svelte', 'related', 'Node.js', 'a framework and its runtime'],
	['SvelteKit', 'related', 'TypeScript', 'a framework and a language'],
	['Svelte / SvelteKit', 'related', 'TypeScript', 'a framework and a language'],
	['Vercel', 'related', 'Svelte', 'a host and what it hosts'],
	['Vercel', 'related', 'Svelte / SvelteKit', 'a host and what it hosts'],
	['Vercel', 'related', 'Next.js', 'a host and what it hosts']
];

/**
 * A language is not a discipline.
 *
 * These licensed "has written Python" to answer a posting asking for backend
 * development, and a data scientist writes Python. Each concept keeps
 * `broader Programming languages`, the claim that is actually true.
 *
 * NOT included, and still open: `APIs broader Backend development` and
 * `Machine Learning broader Data Science`. Those are the same shape but a
 * weaker version of it — API work really is backend work — and they are why
 * `Prompt design` still reaches both.
 */
const LANGUAGE_AS_DISCIPLINE: Ruling[] = [
	['Python', 'broader', 'Backend development', 'keeps Programming languages'],
	['Java', 'broader', 'Backend development', 'keeps Programming languages'],
	['PHP', 'broader', 'Backend development', 'keeps Programming languages'],
	['TypeScript', 'broader', 'Backend development', 'keeps JavaScript, Programming languages'],
	['MongoDB', 'broader', 'Backend development', 'keeps NoSQL, Distributed systems'],
	[
		'JavaScript',
		'broader',
		'Frontend development',
		'keeps Programming languages; was already tagged audit:not-implication'
	]
];

/**
 * `inDomain` restored to what its docstring says it is: a CATEGORY rooted under
 * a domain, not every concept tagged individually.
 *
 * The rule applied is the one the docstring implies — a node needs its own
 * domain edge only when nothing above it has one. Computed against the post-audit
 * hierarchy, not judged: retire where an ancestor still carries a domain, keep
 * where the node is a matching root. That leaves 23 edges on 22 nodes, every one
 * a discipline or category with no parent, and takes `IT` from degree 79 to 22.
 *
 * The `why` on each row names the ancestor that carries the domain instead, as
 * measured on dev. On another environment the hierarchy may differ, which is
 * exactly why this is a list of decisions and not a query: re-deriving it there
 * would silently apply a different rule.
 *
 * Nothing here changes matching — `inDomain` is drawn and never walked. It
 * changes the picture, which is the only thing the relation was ever for.
 */
const INDOMAIN_REDUNDANT: Ruling[] = [
	['Agile', 'inDomain', 'IT', 'climbs to Project management'],
	['Agile methodologies', 'inDomain', 'IT', 'climbs to Agile'],
	['AI / LLM integrations', 'inDomain', 'IT', 'climbs to AI'],
	['AI coding tools', 'inDomain', 'IT', 'climbs to AI'],
	['AI-Assisted Development', 'inDomain', 'IT', 'climbs to Software development'],
	['API development', 'inDomain', 'IT', 'climbs to APIs'],
	['APIs', 'inDomain', 'IT', 'climbs to Backend development'],
	['Authentication', 'inDomain', 'IT', 'climbs to Security'],
	['AWS', 'inDomain', 'IT', 'climbs to Cloud platforms'],
	['Build tools', 'inDomain', 'IT', 'climbs to Developer tools'],
	['CI/CD', 'inDomain', 'IT', 'climbs to DevOps'],
	['Cloud services', 'inDomain', 'IT', 'climbs to Cloud platforms'],
	['Container orchestration', 'inDomain', 'IT', 'climbs to Containerization'],
	['Content Management Systems', 'inDomain', 'IT', 'climbs to Web development'],
	['CSS', 'inDomain', 'IT', 'climbs to Frontend development'],
	['Developer tools', 'inDomain', 'IT', 'climbs to Software development'],
	['Distributed systems', 'inDomain', 'IT', 'climbs to Software Architecture'],
	['E-commerce platforms', 'inDomain', 'IT', 'climbs to E-commerce'],
	['Embedded databases', 'inDomain', 'IT', 'climbs to Databases'],
	['End-to-end testing', 'inDomain', 'IT', 'climbs to Testing'],
	['Frontend development', 'inDomain', 'IT', 'climbs to Web development'],
	['Hosting services', 'inDomain', 'IT', 'climbs to Cloud platforms'],
	['HTML', 'inDomain', 'IT', 'climbs to Frontend development'],
	['Infrastructure as Code', 'inDomain', 'IT', 'climbs to Developer tools'],
	['Integrated Development Environments', 'inDomain', 'IT', 'climbs to Developer tools'],
	['JavaScript', 'inDomain', 'IT', 'climbs to Frontend development'],
	['JavaScript framework', 'inDomain', 'IT', 'climbs to JavaScript'],
	['Knowledge Graphs', 'inDomain', 'IT', 'climbs to Data modeling'],
	['Knowledge representation', 'inDomain', 'IT', 'climbs to AI'],
	['LLM APIs', 'inDomain', 'IT', 'climbs to APIs'],
	['Machine Learning', 'inDomain', 'IT', 'climbs to AI'],
	['Message queues', 'inDomain', 'IT', 'climbs to Distributed systems'],
	['Monitoring', 'inDomain', 'IT', 'climbs to Observability'],
	['NoSQL', 'inDomain', 'IT', 'climbs to Databases'],
	['Observability', 'inDomain', 'IT', 'climbs to DevOps'],
	['Observability framework', 'inDomain', 'IT', 'climbs to Observability'],
	['Programming languages', 'inDomain', 'IT', 'climbs to Software development'],
	['Python', 'inDomain', 'IT', 'climbs to Backend development'],
	['RAG pipelines', 'inDomain', 'IT', 'climbs to Retrieval Augmented Generation'],
	['React', 'inDomain', 'IT', 'climbs to Frontend development'],
	['Scalable architecture', 'inDomain', 'IT', 'climbs to Software Architecture'],
	['Shell scripting', 'inDomain', 'IT', 'climbs to Backend development'],
	['Software Architecture', 'inDomain', 'IT', 'climbs to System Design'],
	['Software Design', 'inDomain', 'IT', 'climbs to Software development'],
	['Software development processes', 'inDomain', 'IT', 'climbs to Software development'],
	['SQL', 'inDomain', 'IT', 'climbs to Data query languages'],
	['SQL optimization', 'inDomain', 'IT', 'climbs to Software Design'],
	['System Design', 'inDomain', 'IT', 'climbs to Software Design'],
	['Template engines', 'inDomain', 'IT', 'climbs to Developer tools'],
	['Testing', 'inDomain', 'IT', 'climbs to Software development'],
	['Unit / Integration Testing', 'inDomain', 'IT', 'climbs to Testing'],
	['User Interfaces', 'inDomain', 'IT', 'climbs to UXD'],
	['UXD', 'inDomain', 'IT', 'climbs to Design'],
	['Web analytics', 'inDomain', 'IT', 'climbs to Analytics'],
	['Web development', 'inDomain', 'IT', 'climbs to Software development'],
	['Web frameworks', 'inDomain', 'IT', 'climbs to Web development'],
	['Web servers', 'inDomain', 'IT', 'climbs to Backend development']
];

/**
 * Concepts the extractor produced that are not skills.
 *
 * The Dutch entries are whole sentences from job postings. "WO werk- en
 * denkniveau" is an education level. The adjectives are the soft-skill half of a
 * CV, which this vocabulary does not model and should not pretend to.
 *
 * Deleting cascades to aliases and relations, so `deleteConcepts` re-checks its
 * own premise on every target rather than trusting this list: anything holding
 * an approved edge or used by a profile is left alone and reported. On dev none
 * were, and the five relations that existed were already rejected.
 */
const NOT_SKILLS: [string, string][] = [
	['Analytical', 'soft-skill adjective'],
	['Communicative', 'soft-skill adjective'],
	['Creative', 'soft-skill adjective'],
	['Emphatic', 'soft-skill adjective, and a misspelling of "empathic"'],
	['Positive', 'soft-skill adjective'],
	['Results-oriented', 'soft-skill adjective'],
	['Service-oriented', 'soft-skill adjective'],
	['Uitstekende beheersing van de Nederlandse taal', 'a Dutch sentence; "Dutch" already exists'],
	['Politiek-bestuurlijke sensitiviteit', 'a Dutch posting phrase'],
	['Automatiseringstechnologieën', 'a Dutch posting phrase'],
	['WO werk- en denkniveau (WO-master)', 'an education level, not a skill'],
	['Packages', 'fragment'],
	['Enquiries', 'fragment'],
	['Delta', 'fragment — ambiguous between Delta Lake, the airline and the letter']
];

/**
 * Two repairs that keep every surface form resolvable.
 *
 * A concept is deleted only where nothing should resolve to it. These are the
 * opposite case: the string a person typed is fine, the row behind it was not.
 * The old slug survives as an alias and `expandUpward`, which seeds from slug
 * AND alias, keeps answering it.
 */
const DUPLICATES: [string, string, string][] = [
	[
		'Recursive CTEs',
		'Recursive Common Table Expressions',
		'the same concept twice, no alias between them'
	]
];

const TYPOS: [string, string, string][] = [
	['Mendrix', 'Mendix', 'the low-code platform, misspelled by the extractor']
];

console.log(APPLY ? 'APPLYING' : 'DRY RUN — nothing is written');
console.log(`before: ${await snapshot()}`);

const t = tally();
merge(t, await reject('related — association, not alternative', CO_OCCURRENCE, APPLY));
merge(t, await reject('a language is not a discipline', LANGUAGE_AS_DISCIPLINE, APPLY));
merge(
	t,
	await reject('inDomain — an ancestor already carries the domain', INDOMAIN_REDUNDANT, APPLY)
);
merge(t, await mergeConcept('merge duplicates', DUPLICATES, APPLY));
merge(t, await renameConcept('correct typos', TYPOS, APPLY));
merge(t, await deleteConcepts('delete non-skills', NOT_SKILLS, APPLY));

console.log(`\nafter:  ${await snapshot()}`);

// Only meaningful once the inDomain rulings are in, which is why it runs here
// rather than as a precondition. Empty on dev; anything named on another target
// is a node this list stranded, and wants a domain edge of its own.
const stranded = await strandedBy(INDOMAIN_REDUNDANT.map((r) => r[0]));
if (stranded.length > 0) {
	console.log(`\n${stranded.length} concept(s) these inDomain rulings stranded:`);
	for (const s of stranded) console.log(`  ~ ${s}`);
	console.log(
		'  (a finding, not a failure — this graph roots differently from dev; each wants its own domain edge)'
	);
}

report(t, APPLY);
