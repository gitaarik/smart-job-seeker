/**
 * Move the skill graph between environments, from a terminal.
 *
 * In DEV, where the source tree is mounted:
 *
 *   docker compose exec -T app npx tsx scripts/ontology-transfer.ts --export > ontology.json
 *   docker compose exec -T app npx tsx scripts/ontology-transfer.ts --import ontology.json
 *   docker compose exec -T app npx tsx scripts/ontology-transfer.ts --import ontology.json --apply
 *
 * On a DEPLOYED box, where it does not:
 *
 *   docker compose exec -T app node dist-scripts/ontology-transfer.mjs --export > ontology.json
 *   docker compose exec -T app node dist-scripts/ontology-transfer.mjs --import ontology.json
 *   docker compose exec -T app node dist-scripts/ontology-transfer.mjs --import ontology.json --apply
 *
 * The second form is the one that matters here, and it is written out because
 * the first one FAILS there rather than degrading: production images ship
 * `dist-scripts/` and no `src/`, so `npx tsx scripts/…` dies with
 * `Cannot find module '/app/src/lib/server/job/ontology-transfer'`. Bootstrapping
 * a fresh environment is this script's whole reason to exist, and a fresh
 * environment is exactly where the dev invocation does not work — met on
 * preview's first v0.24.0 deploy.
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
	collisionAdvice,
	describeCollisions,
	exportBundle,
	parseBundle,
	plan
} from '../src/lib/server/job/ontology-transfer';

/**
 * Write to stdout and WAIT for the write to flush before returning.
 *
 * `process.exit()` does not flush an asynchronous write, and stdout IS
 * asynchronous whenever it is a pipe — which is every
 * `docker compose exec -T … --export > file`. The bundle came out cut at
 * exactly 65536 bytes, the pipe buffer, mid-string.
 *
 * It happened to fail loudly at `parseBundle` because the cut landed inside a
 * string. A cut that landed on a byte closing the JSON would have produced a
 * VALID bundle missing most of the graph, and `applyPlan` only ever adds — so
 * the import would have reported a modest number of new rows and looked like a
 * success.
 */
function writeOut(text: string): Promise<void> {
	return new Promise((resolve, reject) =>
		process.stdout.write(text, (err) => (err ? reject(err) : resolve()))
	);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const apply = args.includes('--apply');
	const importIdx = args.indexOf('--import');

	if (args.includes('--export')) {
		await writeOut(JSON.stringify(await exportBundle(), null, '\t') + '\n');
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
			`Refusing to import — ${p.collisions.length} string(s) are a CONCEPT on one side and an ` +
				`APPROVED ALIAS on the other. Importing would make the vocabulary claim both ` +
				`"same node" and "two nodes".\n` +
				describeCollisions(p.collisions).slice(0, 10).join('\n') +
				`\n\n${collisionAdvice(p.collisions)}`
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
	// Both forms, because the import that most needs auditing afterwards is the
	// one into a fresh deployed box, where the tsx form is the one that fails.
	console.log('Verify the graph did not contradict itself on arrival:');
	console.log('  npx tsx scripts/audit-skill-ontology.ts       # dev');
	console.log('  node dist-scripts/audit-skill-ontology.mjs    # deployed');
	process.exit(0);
}

await main();
