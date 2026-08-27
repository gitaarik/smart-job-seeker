/**
 * Move the skill graph between environments, from a terminal.
 *
 *   docker compose exec -T app npx tsx scripts/ontology-transfer.ts --export > ontology.json
 *   docker compose exec -T app npx tsx scripts/ontology-transfer.ts --import ontology.json
 *   docker compose exec -T app npx tsx scripts/ontology-transfer.ts --import ontology.json --apply
 *
 * Import is a dry run without `--apply`.
 *
 * ## Why this exists
 *
 * `skill_concepts`, `skill_aliases` and `skill_relations` are populated by no
 * migration and no seed — `ALL_SEED_TABLES` in `create-dev-seed.ts` lists
 * `job_platforms`, `ai_chat_templates` and `tech_skill_types`, and the graph is
 * not among them. It exists only where somebody built it.
 *
 * So a deployed environment starts empty, and everything keyed off the graph
 * degrades in silence rather than failing: `expandUpward` returns nothing,
 * matching falls back to the 10.7% recall of exact comparison,
 * `matched_skill_details` reports only `literal` and `llm`, and
 * `adjacent_skills` is empty on every match. Nothing errors.
 *
 * ## Why a CLI when the admin page can do this
 *
 * Because a fresh environment has an empty graph BEFORE anyone can log in to
 * click anything, and because a deploy script cannot press a button. The
 * mechanism is shared — see `$lib/server/job/ontology-transfer` — so the two
 * cannot disagree about what an import would change.
 */
import { readFileSync } from 'node:fs';
import {
	applyPlan,
	exportBundle,
	parseBundle,
	plan
} from '../src/lib/server/job/ontology-transfer';

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const apply = args.includes('--apply');
	const importIdx = args.indexOf('--import');

	if (args.includes('--export')) {
		process.stdout.write(JSON.stringify(await exportBundle(), null, '\t') + '\n');
		process.exit(0);
	}

	if (importIdx === -1 || !args[importIdx + 1]) {
		console.error('usage: --export | --import <file> [--apply]');
		process.exit(1);
	}

	const bundle = parseBundle(readFileSync(args[importIdx + 1], 'utf8'));
	const p = await plan(bundle);

	if (p.collisions.length > 0) {
		console.error(
			`Refusing to import — ${p.collisions.length} concept slug(s) are already an APPROVED ALIAS ` +
				`of a different concept here. Importing them would make the vocabulary claim both ` +
				`"same node" and "two nodes". Resolve with scripts/audit-skill-ontology.ts first:\n` +
				p.collisions
					.slice(0, 10)
					.map((c) => `  "${c.slug}" is an alias of "${c.aliasOf}"`)
					.join('\n')
		);
		process.exit(1);
	}

	console.log(
		`target holds ${p.have.concepts} concepts, ${p.have.aliases} aliases, ` +
			`${p.have.relations} edges.\n` +
			`bundle carries ${bundle.concepts.length} concepts, ${bundle.aliases.length} aliases, ` +
			`${bundle.relations.length} edges.\n`
	);
	console.log(`would ADD  ${p.concepts.length} concepts`);
	console.log(
		`           ${p.aliases.length} aliases (${p.aliases.filter((a) => a.approved).length} APPROVED)`
	);
	console.log(
		`           ${p.relations.length} edges (${p.relations.filter((r) => r.approved).length} APPROVED)`
	);
	if (p.orphans.aliases + p.orphans.relations > 0) {
		console.log(
			`\nskipping ${p.orphans.aliases} alias(es) and ${p.orphans.relations} edge(s) ` +
				`whose concepts are in neither the bundle nor this database.`
		);
	}

	// Said plainly because it is the consequential part. Everything else the
	// proposers write is inert until reviewed; these rows are not.
	if (p.approved > 0) {
		console.log(
			`\n${p.approved} of these arrive ALREADY APPROVED and take effect on the next match ` +
				`for every profile. That is right when bootstrapping from a trusted environment and ` +
				`wrong otherwise.`
		);
	}

	if (!apply) {
		console.log('\nDry run. Pass --apply to write.');
		process.exit(0);
	}

	const wrote = await applyPlan(p);
	console.log(
		`\nWrote ${wrote.concepts} concepts, ${wrote.aliases} aliases, ${wrote.relations} edges.`
	);
	console.log('Verify the graph did not contradict itself on arrival:');
	console.log('  npx tsx scripts/audit-skill-ontology.ts');
	process.exit(0);
}

await main();
