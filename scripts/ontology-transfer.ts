/**
 * Move the skill graph between environments.
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
 * So a deployed environment starts with an empty graph, and everything keyed off
 * it degrades in silence rather than failing: `expandUpward` returns nothing,
 * `getExpandedProfileSkills` falls back to the raw skills, and matching drops
 * from 96.4% recall to the 10.7% of exact comparison (`match-utils.ts`).
 * `matched_skill_details` reports only `literal` and `llm`, and
 * `adjacent_skills` is empty on every match. Nothing errors. It just quietly
 * does much less, which is the failure mode this project keeps meeting.
 *
 * ## Why not pg_dump
 *
 * Because `id` is a serial and `skill_aliases.concept_id` / `skill_relations`
 * point at it. A `--data-only` dump carries dev's ids, and on any target that
 * already holds concepts those ids belong to different rows — the aliases and
 * edges would silently reattach to the wrong ones. This transfers by SLUG,
 * which is the only identity the two databases agree on, and re-resolves every
 * reference on arrival.
 *
 * ## What import will and will not do
 *
 * It only ever ADDS. A concept whose slug already exists keeps the label it
 * has; an alias or edge that already exists is left alone. Nothing is updated
 * and nothing is deleted, so a partial or repeated run cannot damage a graph
 * somebody has since edited, and running it twice is a no-op.
 *
 * It DOES carry `approved_at` and `rejected_at`, and that is the one thing
 * worth understanding before running it. Approval is the gate the whole design
 * rests on — a wrong edge is invisible and global — so importing an approved
 * graph is importing somebody's review decisions wholesale. That is correct for
 * bootstrapping an environment from a trusted one and wrong for anything else,
 * which is why the dry run counts approved rows separately and loudly.
 *
 * `rejected_at` travels for the same reason in reverse: a rejection is a
 * decision, and dropping it invites the proposers to re-suggest what a human
 * already turned down.
 *
 * ## What it refuses
 *
 * A slug that the target already holds as an APPROVED ALIAS of a different
 * concept. That is audit defect 1 — the vocabulary would assert both "these are
 * the same node" and "these are two nodes", and which one a lookup finds comes
 * down to `UNION` order. It is a real hazard rather than a theoretical one: a
 * proposer run produced twelve of them on 2026-08-27. Import stops rather than
 * create any.
 */
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { normalizeSkill } from '../src/lib/skills';

/** Bumped only when the shape changes in a way an older importer cannot read. */
const FORMAT_VERSION = 1;

interface Bundle {
	version: number;
	concepts: { slug: string; label: string }[];
	aliases: {
		alias: string;
		concept: string;
		source: string;
		approved: boolean;
		rejected: boolean;
	}[];
	relations: {
		from: string;
		to: string;
		relation: string;
		confidence: number | null;
		source: string;
		approved: boolean;
		rejected: boolean;
	}[];
}

async function exportBundle(): Promise<Bundle> {
	const concepts = await queryRawDirect<{ slug: string; label: string }>(
		sql`SELECT slug, label FROM skill_concepts ORDER BY slug`
	);
	const aliases = await queryRawDirect<{
		alias: string;
		concept: string;
		source: string;
		approved: boolean;
		rejected: boolean;
	}>(sql`
		SELECT a.alias, c.slug AS concept, a.source,
		       (a.approved_at IS NOT NULL) AS approved,
		       (a.rejected_at IS NOT NULL) AS rejected
		FROM skill_aliases a JOIN skill_concepts c ON c.id = a.concept_id
		ORDER BY a.alias
	`);
	const relations = await queryRawDirect<{
		from: string;
		to: string;
		relation: string;
		confidence: number | null;
		source: string;
		approved: boolean;
		rejected: boolean;
	}>(sql`
		SELECT f.slug AS from, t.slug AS to, r.relation, r.confidence, r.source,
		       (r.approved_at IS NOT NULL) AS approved,
		       (r.rejected_at IS NOT NULL) AS rejected
		FROM skill_relations r
		JOIN skill_concepts f ON f.id = r.from_id
		JOIN skill_concepts t ON t.id = r.to_id
		ORDER BY f.slug, t.slug, r.relation
	`);
	return { version: FORMAT_VERSION, concepts, aliases, relations };
}

function parseBundle(path: string): Bundle {
	const raw = JSON.parse(readFileSync(path, 'utf8'));
	if (raw?.version !== FORMAT_VERSION) {
		throw new Error(
			`bundle version ${raw?.version} — this script writes and reads ${FORMAT_VERSION}`
		);
	}
	for (const key of ['concepts', 'aliases', 'relations'] as const) {
		if (!Array.isArray(raw[key])) throw new Error(`bundle is missing "${key}"`);
	}
	return raw as Bundle;
}

/** What the target already holds, so the report counts what would CHANGE. */
async function targetState() {
	const concepts = new Map(
		(
			await queryRawDirect<{ slug: string; label: string }>(
				sql`SELECT slug, label FROM skill_concepts`
			)
		).map((c) => [c.slug, c.label])
	);
	const aliases = new Map(
		(
			await queryRawDirect<{ alias: string; concept: string }>(sql`
				SELECT a.alias, c.slug AS concept
				FROM skill_aliases a JOIN skill_concepts c ON c.id = a.concept_id
			`)
		).map((a) => [a.alias, a.concept])
	);
	const approvedAliases = new Map(
		(
			await queryRawDirect<{ alias: string; concept: string }>(sql`
				SELECT a.alias, c.slug AS concept
				FROM skill_aliases a JOIN skill_concepts c ON c.id = a.concept_id
				WHERE a.approved_at IS NOT NULL
			`)
		).map((a) => [a.alias, a.concept])
	);
	const relations = new Set(
		(
			await queryRawDirect<{ key: string }>(sql`
				SELECT f.slug || '|' || t.slug || '|' || r.relation AS key
				FROM skill_relations r
				JOIN skill_concepts f ON f.id = r.from_id
				JOIN skill_concepts t ON t.id = r.to_id
			`)
		).map((r) => r.key)
	);
	return { concepts, aliases, approvedAliases, relations };
}

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

	const bundle = parseBundle(args[importIdx + 1]);
	const target = await targetState();

	// Normalise on the way in. The bundle came from a database that normalized
	// on the way out, but a hand-edited one may not have, and a slug that is not
	// `normalizeSkill`'d is a row every lookup will miss.
	const concepts = bundle.concepts
		.map((c) => ({ slug: normalizeSkill(c.slug), label: c.label }))
		.filter((c) => !!c.slug);
	const conceptSlugs = new Set(concepts.map((c) => c.slug));

	// Refuse before writing anything: a slug the target holds as an approved
	// alias of a DIFFERENT concept is audit defect 1, and it is unfixable by
	// hand afterwards without knowing which reading was meant.
	const collisions = concepts.filter((c) => {
		const of = target.approvedAliases.get(c.slug);
		return of !== undefined && of !== c.slug;
	});
	if (collisions.length > 0) {
		console.error(
			`Refusing to import — ${collisions.length} concept slug(s) are already an APPROVED ALIAS ` +
				`of a different concept here. Importing them would make the vocabulary claim both ` +
				`"same node" and "two nodes". Resolve with scripts/audit-skill-ontology.ts first:\n` +
				collisions
					.slice(0, 10)
					.map((c) => `  "${c.slug}" is an alias of "${target.approvedAliases.get(c.slug)}"`)
					.join('\n')
		);
		process.exit(1);
	}

	const newConcepts = concepts.filter((c) => !target.concepts.has(c.slug));
	const newAliases = bundle.aliases
		.map((a) => ({ ...a, alias: normalizeSkill(a.alias), concept: normalizeSkill(a.concept) }))
		.filter((a) => a.alias && a.concept && !target.aliases.has(a.alias));
	const newRelations = bundle.relations
		.map((r) => ({ ...r, from: normalizeSkill(r.from), to: normalizeSkill(r.to) }))
		.filter((r) => r.from && r.to && !target.relations.has(`${r.from}|${r.to}|${r.relation}`));

	// An alias or edge whose endpoints are neither in the bundle nor already here
	// has nothing to attach to. Reported rather than dropped in silence — it means
	// the bundle is incomplete, which is worth knowing before matching quietly
	// under-performs.
	const known = (slug: string) => conceptSlugs.has(slug) || target.concepts.has(slug);
	const orphanAliases = newAliases.filter((a) => !known(a.concept));
	const orphanRelations = newRelations.filter((r) => !known(r.from) || !known(r.to));

	console.log(
		`target holds ${target.concepts.size} concepts, ${target.aliases.size} aliases, ` +
			`${target.relations.size} edges.\n` +
			`bundle carries ${concepts.length} concepts, ${bundle.aliases.length} aliases, ` +
			`${bundle.relations.length} edges.\n`
	);
	console.log(`would ADD  ${newConcepts.length} concepts`);
	console.log(
		`           ${newAliases.length - orphanAliases.length} aliases ` +
			`(${newAliases.filter((a) => a.approved).length} of them APPROVED)`
	);
	console.log(
		`           ${newRelations.length - orphanRelations.length} edges ` +
			`(${newRelations.filter((r) => r.approved).length} of them APPROVED)`
	);
	if (orphanAliases.length + orphanRelations.length > 0) {
		console.log(
			`\nskipping ${orphanAliases.length} alias(es) and ${orphanRelations.length} edge(s) ` +
				`whose concepts are in neither the bundle nor this database.`
		);
	}

	// Said plainly because it is the consequential part. Everything else here is
	// inert until reviewed; these rows are not.
	const approvedCount =
		newAliases.filter((a) => a.approved && known(a.concept)).length +
		newRelations.filter((r) => r.approved && known(r.from) && known(r.to)).length;
	if (approvedCount > 0) {
		console.log(
			`\n${approvedCount} of these arrive ALREADY APPROVED and take effect on the next match ` +
				`for every profile. That is right when bootstrapping from a trusted environment and ` +
				`wrong otherwise.`
		);
	}

	if (!apply) {
		console.log('\nDry run. Pass --apply to write.');
		process.exit(0);
	}

	for (const c of newConcepts) {
		await db.execute(
			sql`INSERT INTO skill_concepts (slug, label) VALUES (${c.slug}, ${c.label})
			    ON CONFLICT (slug) DO NOTHING`
		);
	}
	let aliased = 0;
	for (const a of newAliases) {
		if (!known(a.concept)) continue;
		const res = await db.execute(sql`
			INSERT INTO skill_aliases (concept_id, alias, source, approved_at, rejected_at)
			SELECT c.id, ${a.alias}, ${a.source},
			       ${a.approved ? sql`now()` : sql`NULL`}, ${a.rejected ? sql`now()` : sql`NULL`}
			FROM skill_concepts c WHERE c.slug = ${a.concept}
			ON CONFLICT (alias) DO NOTHING
		`);
		aliased += res.rowCount ?? 0;
	}
	let edges = 0;
	for (const r of newRelations) {
		if (!known(r.from) || !known(r.to)) continue;
		const res = await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source, approved_at, rejected_at)
			SELECT f.id, t.id, ${r.relation}, ${r.confidence ?? 1}, ${r.source},
			       ${r.approved ? sql`now()` : sql`NULL`}, ${r.rejected ? sql`now()` : sql`NULL`}
			FROM skill_concepts f, skill_concepts t
			WHERE f.slug = ${r.from} AND t.slug = ${r.to}
			ON CONFLICT DO NOTHING
		`);
		edges += res.rowCount ?? 0;
	}

	console.log(`\nWrote ${newConcepts.length} concepts, ${aliased} aliases, ${edges} edges.`);
	console.log('Verify the graph did not contradict itself on arrival:');
	console.log('  npx tsx scripts/audit-skill-ontology.ts');
	process.exit(0);
}

await main();
