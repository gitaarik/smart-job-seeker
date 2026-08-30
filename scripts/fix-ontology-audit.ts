/**
 * The 2026-08-30 ontology audit: the rows that were simply wrong.
 *
 * Read the whole approved graph, walked it with `expandUpward`'s own CTE, and
 * found four edges putting real false positives into matching plus thirteen with
 * a parent that is not theirs. Companion: `fix-ontology-decisions.ts`, which
 * carries the four judgements this pass deliberately left to a person.
 *
 * Rulings are addressed by SLUG, not by id — see `lib/ontology-replay.ts` for
 * why, and for what "absent" means on a target that never had the edge. Safe and
 * idempotent to run anywhere; run it against preview to carry this cleanup there,
 * since `ontology-transfer.ts` only ever adds and cannot retire anything.
 *
 *   docker compose exec -T app npx tsx scripts/fix-ontology-audit.ts
 *   docker compose exec -T app npx tsx scripts/fix-ontology-audit.ts --apply
 */
import { refuseNewRelation } from '../src/lib/server/job/skill-relation-guards';
import { draw, merge, reject, report, snapshot, tally, type Ruling } from './lib/ontology-replay';

const APPLY = process.argv.includes('--apply');

/**
 * Four edges, each load-bearing for a subtree that had no business reaching what
 * it reached. Verified against the live graph before and after, not inferred.
 */
const FALSE_MATCHES: Ruling[] = [
	[
		'Design',
		'broader',
		'Software development',
		'design is not a kind of software development; sent Illustrator and InDesign there'
	],
	[
		'Design tools',
		'broader',
		'Developer tools',
		'the same claim one level down; sent Figma and Tailwind the same way'
	],
	[
		'Project management',
		'broader',
		'Software development processes',
		'inverted — processes are a kind of project management, not the reverse; drawn back below'
	],
	[
		'Analytics',
		'broader',
		'Data Science',
		'reporting on numbers is not the discipline; pulled in Google Analytics, Power BI, Tableau'
	],
	['Prompt design', 'broader', 'AI coding tools', 'a practice is not a kind of tool category']
];

/**
 * Wrong as sentences rather than dangerous as paths. Each already had a correct
 * parent beside it, so rejecting cost nothing; the three that did not are drawn
 * below.
 */
const WRONG_PARENT: Ruling[] = [
	['Bash', 'broader', 'Operating systems', 'a shell is not an OS; keeps Shell scripting'],
	[
		'GraphQL',
		'broader',
		'Programming languages',
		'a query language; Data query languages drawn below'
	],
	['Taxonomies', 'broader', 'Data formats', 'keeps Knowledge representation and Data modeling'],
	['Terraform', 'broader', 'Cloud platforms', 'keeps Infrastructure as Code and DevOps'],
	['Azure OpenAI', 'broader', 'Cloud platforms', 'a service ON one; requires Azure drawn below'],
	['Tailwind CSS', 'broader', 'Design tools', 'a CSS framework, not a design tool; keeps CSS'],
	['YAML', 'broader', 'Developer tools', 'a format; keeps Data formats'],
	['Parquet', 'broader', 'Data Science', 'a file format is not a discipline; keeps Data formats'],
	['Code review', 'broader', 'Developer tools', 'a practice, not a tool'],
	['Code review', 'broader', 'Software Design', 'not a kind of software design'],
	['Security', 'broader', 'Software Design', 'a top-level discipline; becomes a matching root'],
	['Jira', 'broader', 'Developer tools', 'second path from project work into software development'],
	['MongoDB', 'requires', 'JSON', 'stores BSON; running Mongo implies no JSON experience']
];

/** `related` that says something untrue rather than merely uninteresting. */
const RELATED_UNTRUE: Ruling[] = [
	['WordPress', 'related', 'CRM', 'WordPress is a CMS'],
	[
		'Scalability',
		'related',
		'Scaling startups',
		'a pun on "scaling" joining a systems property to a business skill'
	],
	['Monitoring', 'related', 'Security', 'shares only "operational concern"'],
	['Observability', 'related', 'Security', 'shares only "operational concern"'],
	['Maintenance', 'related', 'Security', 'shares only "operational concern"'],
	['Jest', 'related', 'React', 'not an alternative to React']
];

/**
 * The case `propose-skill-relations.ts` already refuses to propose: an approved
 * implication path connects the pair, so a `related` edge saying neither implies
 * the other is the graph contradicting itself. The rule went into the proposer
 * and never ran backwards over what was already approved.
 */
const RELATED_IMPLIED: Ruling[] = [
	['API testing', 'related', 'Unit Testing', 'implication path already connects them'],
	['Next.js', 'related', 'Backend development', 'implication path already connects them'],
	['SvelteKit', 'related', 'Backend development', 'implication path already connects them']
];

/**
 * Every row that was sitting in the review queue, ruled on rather than drained.
 *
 * The first version of this script rejected whatever was pending, full stop.
 * That was true of dev at that moment — all 38 had been classified against the
 * approved graph and not one added a fact it did not already have — and it is
 * not a thing to do to another environment, whose queue is its own and may hold
 * proposals nobody has read. So they are enumerated: 22 duplicate an approved
 * pair under a different relation name (the unique index is on
 * (from, to, relation), so a duplicate lands beside the edge it repeats), and 16
 * are the reverse of an implication the graph already holds and would close a
 * loop if approved.
 *
 * `propose-skill-relations.ts` now drops both classes before they reach the
 * queue, so this list is history rather than maintenance. It stays because a
 * target that has not had the filter yet may be holding the same 38.
 */
const DEAD_PROPOSALS: Ruling[] = [
	['Agile', 'broader', 'Scrum/Agile', 'the reverse is already implied: Scrum/Agile => Agile'],
	[
		'Agile',
		'broader',
		'Agile methodologies',
		'the reverse is already implied: Agile methodologies => Agile'
	],
	['AI / LLM integrations', 'broader', 'LLM', 'already approved or implied in this direction'],
	[
		'API development',
		'broader',
		'Backend development',
		'already approved or implied in this direction'
	],
	['API testing', 'broader', 'Unit Testing', 'already approved or implied in this direction'],
	['CI/CD', 'broader', 'Azure DevOps', 'the reverse is already implied: Azure DevOps => CI/CD'],
	[
		'Containerization',
		'broader',
		'Container orchestration',
		'the reverse is already implied: Container orchestration => Containerization'
	],
	[
		'Databases',
		'broader',
		'Vector Stores',
		'the reverse is already implied: Vector Stores => Databases'
	],
	['Databases', 'broader', 'NoSQL', 'the reverse is already implied: NoSQL => Databases'],
	['Deployment', 'broader', 'DevOps', 'the reverse is already implied: DevOps => Deployment'],
	['Docker Compose', 'broader', 'Docker', 'already approved or implied in this direction'],
	['ETL', 'broader', 'Matillion', 'the reverse is already implied: Matillion => ETL'],
	[
		'LangChain',
		'broader',
		'AI / LLM integrations',
		'already approved or implied in this direction'
	],
	['Machine Learning', 'broader', 'LLM', 'the reverse is already implied: LLM => Machine Learning'],
	[
		'Retrieval Augmented Generation',
		'broader',
		'RAG systems',
		'the reverse is already implied: RAG systems => Retrieval Augmented Generation'
	],
	['Scrum', 'broader', 'Scrum/Agile', 'the reverse is already implied: Scrum/Agile => Scrum'],
	['Scrum/Agile', 'broader', 'Scrum', 'already approved or implied in this direction'],
	['Scrum/Agile', 'broader', 'Agile', 'already approved or implied in this direction'],
	['Svelte / SvelteKit', 'broader', 'Svelte', 'already approved or implied in this direction'],
	[
		'Unit / Integration Testing',
		'broader',
		'Unit Testing',
		'already approved or implied in this direction'
	],
	[
		'Unit Testing',
		'broader',
		'Unit / Integration Testing',
		'the reverse is already implied: Unit / Integration Testing => Unit Testing'
	],
	[
		'Web frameworks',
		'covers',
		'Svelte',
		'the reverse is already implied: Svelte => Web frameworks'
	],
	['Django Channels', 'requires', 'WebSockets', 'already approved or implied in this direction'],
	['LLM', 'requires', 'LLM evaluation', 'the reverse is already implied: LLM evaluation => LLM'],
	[
		'LLM',
		'requires',
		'LLM integrations',
		'the reverse is already implied: LLM integrations => LLM'
	],
	[
		'LLM',
		'requires',
		'AI / LLM integrations',
		'the reverse is already implied: AI / LLM integrations => LLM'
	],
	['LLM APIs', 'requires', 'LLM', 'already approved or implied in this direction'],
	['LLM integrations', 'requires', 'LLM', 'already approved or implied in this direction'],
	[
		'Microservices',
		'requires',
		'Backend development',
		'already approved or implied in this direction'
	],
	['MongoDB', 'requires', 'Backend development', 'already approved or implied in this direction'],
	['NestJS', 'requires', 'Node.js', 'already approved or implied in this direction'],
	['Node.js', 'requires', 'Backend development', 'already approved or implied in this direction'],
	['Node.js', 'requires', 'JavaScript', 'already approved or implied in this direction'],
	['PHP', 'requires', 'Backend development', 'already approved or implied in this direction'],
	['PostgreSQL', 'requires', 'SQL', 'already approved or implied in this direction'],
	['pytest', 'requires', 'Unit Testing', 'already approved or implied in this direction'],
	['Sass', 'requires', 'CSS', 'already approved or implied in this direction'],
	['TDD', 'requires', 'Unit Testing', 'already approved or implied in this direction']
];

/**
 * Replacements, and two compounds that had sat isolated since they were added.
 *
 * Drawn AFTER the rejections above, and the order is load-bearing:
 * `refuseNewRelation` refuses an edge between a pair already joined in either
 * direction, so the corrected `Software development processes broader Project
 * management` cannot be drawn while its inverse is still approved.
 */
const REPLACEMENTS: Ruling[] = [
	[
		'Software development processes',
		'broader',
		'Project management',
		'the correct direction of the rejected edge above'
	],
	['Code review', 'broader', 'Engineering practices', 'replaces both rejected parents'],
	['GraphQL', 'broader', 'Data query languages', 'where SQL already sits'],
	['Azure OpenAI', 'requires', 'Azure', 'restores the cloud reach by the honest route'],
	['Kubernetes/OpenShift', 'covers', 'Kubernetes', 'isolated compound, both parts present'],
	['RHEL/Linux', 'covers', 'Linux', 'isolated compound, compare Unix/Linux covers Linux']
];

console.log(APPLY ? 'APPLYING' : 'DRY RUN — nothing is written');
console.log(`before: ${await snapshot()}`);

const t = tally();
merge(t, await reject('edges producing false matches', FALSE_MATCHES, APPLY));
merge(t, await reject('wrong parent', WRONG_PARENT, APPLY));
merge(t, await reject('related — says something untrue', RELATED_UNTRUE, APPLY));
merge(t, await reject('related — already implied', RELATED_IMPLIED, APPLY));
merge(t, await reject('proposals that add nothing', DEAD_PROPOSALS, APPLY));
merge(t, await draw('replacements', REPLACEMENTS, APPLY, refuseNewRelation, 'audit:2026-08-30'));

console.log(`\nafter:  ${await snapshot()}`);
report(t, APPLY);
