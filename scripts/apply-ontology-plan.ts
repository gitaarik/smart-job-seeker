/**
 * Apply a reviewed ontology plan: the rulings a person made on a review page,
 * written down as one JSON document and applied in one pass.
 *
 *   docker compose exec -T worker npx dotenvx run --quiet -f .env -- \
 *     npx tsx oss/scripts/apply-ontology-plan.ts [--apply] < plan.json
 *
 * Without `--apply` it prints what it would do and writes nothing.
 *
 * ## Why a plan
 *
 * The first review done on a page instead of in /admin/skill-ontology
 * (2026-10-09: the 124 rows `propose-corpus-terms.ts` and
 * `propose-llm-vocabulary.ts` staged, plus skills the corpus model wrongly
 * skipped) came back as 135 decisions, and a fifth of them were "not this, but
 * that": fold a new skill into the one it only renames, hang it somewhere else,
 * point an alias at a closer concept. The queue has buttons for approve and
 * reject only, and re-entering 135 decisions there is the review done twice.
 * The plan carries the rulings; this script only knows how to apply them, by
 * slug, so it can be pointed at another database (see `lib/ontology-replay.ts`).
 *
 * ## Order
 *
 * Merges first, because they delete concepts and the pending rows hanging off
 * them. Then the staged aliases, so a rejected alias is out of the way before a
 * concept takes its name. Then new concepts and new aliases, rejections,
 * approvals, and new edges last, so every guard has the approvals before it to
 * check against. Every edge goes through `refuseNewRelation`, as in the queue.
 *
 * A dry run checks each row against the database as it stands, so it cannot
 * see the plan's own earlier steps: an edge to a concept the plan creates shows
 * as absent, and a loop only batch-mates would close appears on the real run.
 * The real run prints every refusal and leaves the refused row as it was.
 */
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { normalizeSkill } from '../src/lib/skills';
import { refuseNewRelation } from '../src/lib/server/job/skill-relation-guards';
import {
	approve,
	draw,
	merge,
	mergeConcept,
	reject,
	report,
	snapshot,
	tally,
	type Ruling,
	type Tally
} from './lib/ontology-replay';

const APPLY = process.argv.includes('--apply');

/** Concepts and aliases are named by label and resolved by slug throughout. */
interface Plan {
	/**
	 * `source` on every row the plan creates, so its edges can be revoked as one
	 * run with `approve-skill-relations.ts --revoke-source`. At most 32 chars.
	 */
	source: string;
	/** Fold a concept into the one it duplicates; its name stays as an alias. */
	merge?: [dead: string, keep: string, why: string][];
	aliases?: {
		approve?: [alias: string, concept: string, why: string][];
		reject?: [alias: string, concept: string, why: string][];
		/** Point a staged alias at a different concept, and approve it there. */
		retarget?: [alias: string, from: string, to: string, why: string][];
		/** New aliases, approved. */
		add?: [alias: string, concept: string, why: string][];
	};
	concepts?: [label: string, why: string][];
	edges?: { reject?: Ruling[]; approve?: Ruling[]; draw?: Ruling[] };
}

interface AliasRow {
	id: number;
	slug: string;
	approved: boolean;
	rejected: boolean;
}

async function aliasRow(alias: string): Promise<AliasRow | null> {
	const rows = await queryRawDirect<AliasRow>(sql`
		SELECT a.id, c.slug, (a.approved_at IS NOT NULL) AS approved,
		       (a.rejected_at IS NOT NULL) AS rejected
		FROM skill_aliases a JOIN skill_concepts c ON c.id = a.concept_id
		WHERE a.alias = ${normalizeSkill(alias)}
	`);
	return rows[0] ?? null;
}

async function conceptId(label: string): Promise<number | null> {
	const rows = await queryRawDirect<{ id: number }>(sql`
		SELECT id FROM skill_concepts WHERE slug = ${normalizeSkill(label)}
	`);
	return rows[0] ? Number(rows[0].id) : null;
}

/** A staged alias, found where the ruling says it points, or why not. */
async function stagedAlias(t: Tally, alias: string, concept: string): Promise<AliasRow | null> {
	const row = await aliasRow(alias);
	if (!row) {
		t.absent++;
		console.log(`  absent    "${alias}"`);
		return null;
	}
	if (row.slug !== normalizeSkill(concept)) {
		t.problems.push(`alias "${alias}" points at ${row.slug} here, not ${concept}`);
		console.log(`  ELSEWHERE "${alias}" → ${row.slug}`);
		return null;
	}
	return row;
}

async function approveAliases(rulings: [string, string, string][]): Promise<Tally> {
	const t = tally();
	console.log(`\n── approve aliases (${rulings.length})`);
	for (const [alias, concept, why] of rulings) {
		const row = await stagedAlias(t, alias, concept);
		if (!row) continue;
		if (row.approved) {
			t.settled++;
			console.log(`  already   "${alias}" → ${concept}`);
			continue;
		}
		if (row.rejected) {
			t.problems.push(`alias "${alias}" is rejected here, so it was left alone`);
			console.log(`  REJECTED  "${alias}" → ${concept} — left alone`);
			continue;
		}
		if (APPLY) {
			await db.execute(sql`
				UPDATE skill_aliases SET approved_at = now(), rejected_at = NULL WHERE id = ${row.id}
			`);
		}
		t.applied++;
		console.log(`  approve   "${alias}" → ${concept}  — ${why}`);
	}
	return t;
}

async function rejectAliases(rulings: [string, string, string][]): Promise<Tally> {
	const t = tally();
	console.log(`\n── reject aliases (${rulings.length})`);
	for (const [alias, concept, why] of rulings) {
		const row = await stagedAlias(t, alias, concept);
		if (!row) continue;
		if (row.rejected) {
			t.settled++;
			console.log(`  already   "${alias}" → ${concept}`);
			continue;
		}
		if (APPLY) {
			await db.execute(sql`
				UPDATE skill_aliases SET rejected_at = now(), approved_at = NULL WHERE id = ${row.id}
			`);
		}
		t.applied++;
		console.log(`  reject    "${alias}" → ${concept}  — ${why}`);
	}
	return t;
}

async function retargetAliases(
	rulings: [string, string, string, string][],
	source: string
): Promise<Tally> {
	const t = tally();
	console.log(`\n── point aliases elsewhere (${rulings.length})`);
	for (const [alias, from, to, why] of rulings) {
		const row = await aliasRow(alias);
		if (row && row.slug === normalizeSkill(to) && row.approved) {
			t.settled++;
			console.log(`  already   "${alias}" → ${to}`);
			continue;
		}
		const staged = await stagedAlias(t, alias, from);
		if (!staged) continue;
		const target = await conceptId(to);
		if (target === null) {
			t.problems.push(`"${to}" is not in this vocabulary, so "${alias}" stayed on ${from}`);
			console.log(`  MISSING   ${to}`);
			continue;
		}
		// The row now makes a different claim from the one proposed, so it takes
		// this run's source the way a flipped edge takes 'manual'.
		if (APPLY) {
			await db.execute(sql`
				UPDATE skill_aliases
				SET concept_id = ${target}, approved_at = now(), rejected_at = NULL, source = ${source}
				WHERE id = ${staged.id}
			`);
		}
		t.applied++;
		console.log(`  retarget  "${alias}" ${from} → ${to}  — ${why}`);
	}
	return t;
}

async function createConcepts(rulings: [string, string][]): Promise<Tally> {
	const t = tally();
	console.log(`\n── new concepts (${rulings.length})`);
	for (const [label, why] of rulings) {
		if ((await conceptId(label)) !== null) {
			t.settled++;
			console.log(`  already   ${label}`);
			continue;
		}
		// An approved alias with this spelling already answers for another
		// concept; a concept on top of it would make one name mean two skills.
		const alias = await aliasRow(label);
		if (alias?.approved) {
			t.problems.push(`"${label}" is already an approved alias of ${alias.slug}, so no concept`);
			console.log(`  TAKEN     ${label} — alias of ${alias.slug}`);
			continue;
		}
		if (APPLY) {
			await db.execute(sql`
				INSERT INTO skill_concepts (slug, label) VALUES (${normalizeSkill(label)}, ${label})
				ON CONFLICT (slug) DO NOTHING
			`);
		}
		t.applied++;
		console.log(`  create    ${label}  — ${why}`);
	}
	return t;
}

async function addAliases(rulings: [string, string, string][], source: string): Promise<Tally> {
	const t = tally();
	console.log(`\n── new aliases (${rulings.length})`);
	for (const [alias, concept, why] of rulings) {
		const target = await conceptId(concept);
		if (target === null) {
			t.absent++;
			console.log(`  absent    ${concept}`);
			continue;
		}
		const row = await aliasRow(alias);
		if (row) {
			if (row.slug === normalizeSkill(concept) && row.approved) {
				t.settled++;
				console.log(`  already   "${alias}" → ${concept}`);
			} else {
				t.problems.push(`alias "${alias}" exists here, on ${row.slug}; left alone`);
				console.log(`  EXISTS    "${alias}" → ${row.slug}`);
			}
			continue;
		}
		if ((await conceptId(alias)) !== null) {
			t.problems.push(`"${alias}" is a concept of its own here, so it cannot also be an alias`);
			console.log(`  CONCEPT   "${alias}"`);
			continue;
		}
		if (APPLY) {
			await db.execute(sql`
				INSERT INTO skill_aliases (concept_id, alias, source, approved_at)
				VALUES (${target}, ${normalizeSkill(alias)}, ${source}, now())
			`);
		}
		t.applied++;
		console.log(`  add       "${alias}" → ${concept}  — ${why}`);
	}
	return t;
}

async function main(): Promise<void> {
	const plan = JSON.parse(readFileSync(0, 'utf8')) as Plan;
	if (!plan.source || plan.source.length > 32) {
		console.error('The plan needs a "source" of at most 32 characters.');
		process.exit(1);
	}
	console.log(`before: ${await snapshot()}`);

	const t = tally();
	merge(
		t,
		await mergeConcept('fold into the skill they rename', plan.merge ?? [], APPLY, plan.source)
	);
	merge(t, await approveAliases(plan.aliases?.approve ?? []));
	merge(t, await rejectAliases(plan.aliases?.reject ?? []));
	merge(t, await retargetAliases(plan.aliases?.retarget ?? [], plan.source));
	merge(t, await createConcepts(plan.concepts ?? []));
	merge(t, await addAliases(plan.aliases?.add ?? [], plan.source));
	merge(t, await reject('reject edges', plan.edges?.reject ?? [], APPLY));
	merge(t, await approve('approve edges', plan.edges?.approve ?? [], APPLY, refuseNewRelation));
	merge(t, await draw('new edges', plan.edges?.draw ?? [], APPLY, refuseNewRelation, plan.source));

	console.log(`\nafter: ${await snapshot()}`);
	report(t, APPLY);
}

await main();
