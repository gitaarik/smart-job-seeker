/**
 * Move the skill graph between environments — the mechanism, shared by
 * `scripts/ontology-transfer.ts` and the admin page.
 *
 * Shared rather than written twice on purpose. The CLI is how a new environment
 * is bootstrapped, before anyone can log in to click anything; the admin page is
 * how it is done afterwards without SSH. Two implementations of "what would this
 * import change" would drift, and the one that drifted would be the one telling
 * a person it was safe to press the button.
 *
 * ## Why not pg_dump
 *
 * Because `id` is a serial and `skill_aliases.concept_id` / `skill_relations`
 * point at it. A `--data-only` dump carries the source's ids, and on any target
 * that already holds concepts those ids belong to different rows — every alias
 * and edge would silently reattach to the wrong concept. This transfers by
 * SLUG, the only identity two databases agree on, and re-resolves on arrival.
 *
 * ## Import only ever ADDS
 *
 * A concept whose slug already exists keeps the label it has; an alias or edge
 * that already exists is left alone. Nothing is updated and nothing is deleted,
 * so a partial or repeated run cannot damage a graph somebody has since edited,
 * and running it twice is a no-op.
 *
 * It DOES carry `approved_at` and `rejected_at`. Approval is the gate the whole
 * design rests on — a wrong edge is invisible and global — so importing an
 * approved graph is importing somebody's review decisions wholesale. Correct
 * when bootstrapping from a trusted environment, wrong otherwise, which is why
 * `plan()` counts arriving-approved rows separately and every caller is
 * expected to put that number in front of a person before writing.
 *
 * `rejected_at` travels for the same reason in reverse: a rejection is a
 * decision, and dropping it invites the proposers to re-suggest what a human
 * already turned down.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { normalizeSkill } from '$lib/skills';

/** Bumped only when the shape changes in a way an older importer cannot read. */
export const FORMAT_VERSION = 1;

export interface Bundle {
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

export async function exportBundle(): Promise<Bundle> {
	const concepts = await queryRawDirect<{ slug: string; label: string }>(
		sql`SELECT slug, label FROM skill_concepts ORDER BY slug`
	);
	const aliases = await queryRawDirect<Bundle['aliases'][number]>(sql`
		SELECT a.alias, c.slug AS concept, a.source,
		       (a.approved_at IS NOT NULL) AS approved,
		       (a.rejected_at IS NOT NULL) AS rejected
		FROM skill_aliases a JOIN skill_concepts c ON c.id = a.concept_id
		ORDER BY a.alias
	`);
	const relations = await queryRawDirect<Bundle['relations'][number]>(sql`
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

/**
 * Read a bundle from text, refusing anything this importer cannot honestly
 * apply. Throws with a message meant for a person, since both callers show it
 * to one.
 */
export function parseBundle(text: string): Bundle {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error('not valid JSON — expected a bundle from the export button or --export');
	}
	const b = raw as Partial<Bundle> | null;
	if (b?.version !== FORMAT_VERSION) {
		throw new Error(
			`bundle version ${b?.version ?? 'missing'} — this build reads version ${FORMAT_VERSION}`
		);
	}
	for (const key of ['concepts', 'aliases', 'relations'] as const) {
		if (!Array.isArray(b[key])) throw new Error(`bundle is missing "${key}"`);
	}
	return b as Bundle;
}

/** What the target already holds, so a plan counts what would CHANGE. */
async function targetState() {
	const concepts = new Set(
		(await queryRawDirect<{ slug: string }>(sql`SELECT slug FROM skill_concepts`)).map(
			(c) => c.slug
		)
	);
	const aliases = new Set(
		(await queryRawDirect<{ alias: string }>(sql`SELECT alias FROM skill_aliases`)).map(
			(a) => a.alias
		)
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

/**
 * One string that both databases claim, in incompatible ways.
 *
 * `direction` matters because the two are repaired at opposite ends. A bundle
 * CONCEPT the target aliases away is fixed by merging on the target. A bundle
 * ALIAS the target still holds as a concept is fixed by replaying the merge on
 * the target — the source has already done it, which is exactly how this arises.
 */
export interface Collision {
	/** The contested string: a concept slug on one side, an alias on the other. */
	slug: string;
	/** The concept the alias side says it is really spelling. */
	aliasOf: string;
	direction: 'bundle-concept' | 'bundle-alias';
}

export interface ImportPlan {
	/** Counts of what the target holds now, for the "from → to" line. */
	have: { concepts: number; aliases: number; relations: number };
	concepts: { slug: string; label: string }[];
	aliases: Bundle['aliases'];
	relations: Bundle['relations'];
	/** Rows whose concepts exist in neither the bundle nor the target. */
	orphans: { aliases: number; relations: number };
	/** Of the rows above, how many arrive already approved. THE number to show. */
	approved: number;
	/**
	 * Places where the bundle and the target disagree about whether a string is
	 * a node or a spelling. Non-empty means the import must not run.
	 */
	collisions: Collision[];
}

/**
 * Work out what an import would do, without doing any of it.
 *
 * Every caller runs this — including the one that is about to write — so an
 * "apply" never trusts a plan computed earlier or elsewhere. The graph can
 * change between a preview and a confirmation, and the confirmation is the one
 * that matters.
 */
export async function plan(bundle: Bundle): Promise<ImportPlan> {
	const target = await targetState();

	// Normalise on the way in. The bundle came from a database that normalized on
	// the way out, but a hand-edited one may not have, and a slug that is not
	// `normalizeSkill`'d is a row every lookup will miss.
	const concepts = bundle.concepts
		.map((c) => ({ slug: normalizeSkill(c.slug), label: c.label }))
		.filter((c) => !!c.slug);
	const bundleSlugs = new Set(concepts.map((c) => c.slug));
	const known = (slug: string) => bundleSlugs.has(slug) || target.concepts.has(slug);

	// A slug the target holds as an approved alias of a different concept is
	// audit defect 1: the vocabulary would assert both "these are the same node"
	// and "these are two nodes", and which one a lookup finds comes down to
	// `UNION` order. Not theoretical — a proposer run produced twelve on
	// 2026-08-27. Collected rather than thrown so a UI can render them.
	const collisions: Collision[] = concepts.flatMap((c) => {
		const aliasOf = target.approvedAliases.get(c.slug);
		return aliasOf && aliasOf !== c.slug
			? [{ slug: c.slug, aliasOf, direction: 'bundle-concept' as const }]
			: [];
	});

	const newAliases = bundle.aliases
		.map((a) => ({ ...a, alias: normalizeSkill(a.alias), concept: normalizeSkill(a.concept) }))
		.filter((a) => a.alias && a.concept && !target.aliases.has(a.alias));

	// The mirror, and the one this originally missed. A bundle alias whose string
	// the target still holds as its own CONCEPT is the same defect arriving from
	// the other side, and `ON CONFLICT (alias) DO NOTHING` does not catch it: the
	// unique index is on `alias`, and the target has no alias row — it has a
	// concept row. The import would insert happily and leave the vocabulary
	// asserting both readings.
	//
	// It is the normal consequence of repairing the graph anywhere, because
	// `applyPlan` only ever ADDS: a merge on the source turns a concept into an
	// alias, and nothing carries the delete. Dev merged `Vector DBs (pgvector)`
	// into `Vector Stores` on 2026-08-27 while preview still held it as a
	// concept, which is how this was found.
	collisions.push(
		...newAliases
			.filter((a) => target.concepts.has(a.alias) && a.alias !== a.concept)
			.map((a) => ({
				slug: a.alias,
				aliasOf: a.concept,
				direction: 'bundle-alias' as const
			}))
	);
	const newRelations = bundle.relations
		.map((r) => ({ ...r, from: normalizeSkill(r.from), to: normalizeSkill(r.to) }))
		.filter((r) => r.from && r.to && !target.relations.has(`${r.from}|${r.to}|${r.relation}`));

	// An alias or edge whose concepts exist nowhere has nothing to attach to.
	// Counted rather than dropped in silence: it means the bundle is incomplete,
	// which is worth knowing before matching quietly under-performs.
	const attachableAliases = newAliases.filter((a) => known(a.concept));
	const attachableRelations = newRelations.filter((r) => known(r.from) && known(r.to));

	return {
		have: {
			concepts: target.concepts.size,
			aliases: target.aliases.size,
			relations: target.relations.size
		},
		concepts: concepts.filter((c) => !target.concepts.has(c.slug)),
		aliases: attachableAliases,
		relations: attachableRelations,
		orphans: {
			aliases: newAliases.length - attachableAliases.length,
			relations: newRelations.length - attachableRelations.length
		},
		approved:
			attachableAliases.filter((a) => a.approved).length +
			attachableRelations.filter((r) => r.approved).length,
		collisions
	};
}

/**
 * One line per collision, in the words a person can act on. Shared for the same
 * reason `plan()` is: the CLI and the admin page must not describe the same
 * refusal differently.
 */
export function describeCollisions(cs: Collision[]): string[] {
	return cs.map((c) =>
		c.direction === 'bundle-concept'
			? `  the bundle mints "${c.slug}", which is already an approved alias of "${c.aliasOf}" here`
			: `  the bundle spells "${c.slug}" as an alias of "${c.aliasOf}", but "${c.slug}" is still a concept here`
	);
}

/** Why the refusal happened and what to do about it, given both directions. */
export function collisionAdvice(cs: Collision[]): string {
	const stale = cs.some((c) => c.direction === 'bundle-alias');
	return stale
		? `The source has merged concepts this target still holds separately, and an import ` +
				`cannot carry a merge — it only ever ADDS. Replay the merge here (declare the alias, ` +
				`then scripts/audit-skill-ontology.ts --merge-duplicates) and import again.`
		: `Resolve with scripts/audit-skill-ontology.ts --merge-duplicates first.`;
}

/**
 * Apply a plan. Refuses a plan with collisions rather than letting a caller
 * decide to ignore them — the resulting graph is not repairable by hand
 * afterwards without knowing which reading was meant.
 *
 * Every insert is `ON CONFLICT DO NOTHING`, so a run interrupted halfway can be
 * repeated safely.
 */
export async function applyPlan(p: ImportPlan): Promise<{
	concepts: number;
	aliases: number;
	relations: number;
}> {
	if (p.collisions.length > 0) {
		throw new Error(
			`refusing to import: ${p.collisions.length} string(s) are a concept on one side and an ` +
				`alias on the other\n${describeCollisions(p.collisions).join('\n')}`
		);
	}

	for (const c of p.concepts) {
		await db.execute(
			sql`INSERT INTO skill_concepts (slug, label) VALUES (${c.slug}, ${c.label})
			    ON CONFLICT (slug) DO NOTHING`
		);
	}
	let aliases = 0;
	for (const a of p.aliases) {
		const res = await db.execute(sql`
			INSERT INTO skill_aliases (concept_id, alias, source, approved_at, rejected_at)
			SELECT c.id, ${a.alias}, ${a.source},
			       ${a.approved ? sql`now()` : sql`NULL`}, ${a.rejected ? sql`now()` : sql`NULL`}
			FROM skill_concepts c WHERE c.slug = ${a.concept}
			ON CONFLICT (alias) DO NOTHING
		`);
		aliases += res.rowCount ?? 0;
	}
	let relations = 0;
	for (const r of p.relations) {
		const res = await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source, approved_at, rejected_at)
			SELECT f.id, t.id, ${r.relation}, ${r.confidence ?? 1}, ${r.source},
			       ${r.approved ? sql`now()` : sql`NULL`}, ${r.rejected ? sql`now()` : sql`NULL`}
			FROM skill_concepts f, skill_concepts t
			WHERE f.slug = ${r.from} AND t.slug = ${r.to}
			ON CONFLICT DO NOTHING
		`);
		relations += res.rowCount ?? 0;
	}
	return { concepts: p.concepts.length, aliases, relations };
}
