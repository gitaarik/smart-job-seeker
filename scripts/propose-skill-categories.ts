/**
 * Give the orphans a parent: mint category concepts and root them by domain.
 *
 *   docker compose exec -T -e SJS_LLM_API_KEY_GROQ=… app \
 *     npx tsx scripts/propose-skill-categories.ts
 *
 * The dry run saves its plan to /tmp/skill-categories.json. Apply THAT plan —
 * the one you just read — rather than asking again:
 *
 *   … npx tsx scripts/propose-skill-categories.ts --apply --from /tmp/skill-categories.json
 *
 * `--apply` alone re-asks the model, and at temperature 0 it still answers
 * differently: two consecutive runs placed 79 and 94 of the same 134 orphans.
 *
 * ## The gap
 *
 * Measured on dev after the audit pass: **134 of 238 concepts have no approved
 * relation at all.** More than half the vocabulary matches nothing but its own
 * name. Kubernetes, Redis, Playwright, Terraform, PostgreSQL — each an island of
 * one. The graph is not too dense to read, it is too sparse to be worth much.
 *
 * The sibling proposer only relates concepts that already exist, because it
 * works from cosine pairs over the vocabulary. Nothing could ever *mint a
 * parent*, so a category absent from both the profile and every job description
 * stayed absent however many skills needed it. That is this script's whole job.
 *
 * ## Why a category is the safe edge to add
 *
 * `expandUpward` walks upward only, so a shared parent never makes siblings
 * imply each other: `Python broader Programming languages` and `Java broader
 * Programming languages` leave Python → Java false. Categories add recall
 * without the sibling false-positive that cosine similarity produces by
 * construction — and jobs genuinely ask for the category words. "Testing",
 * "SQL", "Cloud", "DevOps" are requirements, not abstractions.
 *
 * ## Domains are drawn, not traversed
 *
 * The desire for one root over everything is a *display* wish, and satisfying it
 * with `broader` would be false: "React is a kind of IT" is domain membership,
 * not subsumption, and the same confusion put `Guest Relations broader Event
 * Planning` into the graph. Worse, a traversed root means any posting mentioning
 * "IT" matches anyone with any technical skill.
 *
 * So domain edges use `inDomain`, which is **not in `MATCHING_RELATIONS`**. The
 * graph draws them; `expandUpward` never walks them; matching cannot regress.
 * If a domain later turns out to be worth matching on, promoting it is one
 * string in that array — the same door `covers` came through.
 *
 * ## Not everything here is a skill
 *
 * `vocabulary()` reads `tech_skills` and `jobs.skills_required`, and both carry
 * things that are not skills. Job parsing put whole requirement sentences there
 * ("Uitstekende beheersing van de Nederlandse taal", "WO werk- en denkniveau")
 * because the parser prompt offers exactly two buckets — technical and
 * interpersonal — and unqualified items default to `skills_required`. The
 * profile contributes trait words of its own: Analytical, Creative, Positive.
 *
 * Inventing a parent category for those would be dressing up noise, so the model
 * classifies first and only skills are categorised. The `requirement` and
 * `trait` verdicts are printed rather than written: they are the input to
 * splitting requirements out of the skills table, which is its own job.
 *
 * Same gate as every proposer: rows land with `approved_at` null.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { generateChatCompletionTracked } from '../src/lib/server/llm/langchain';
import { coerceIndexedEnvelope } from '../src/lib/server/llm/structured-envelope';
import { normalizeSkill } from '../src/lib/skills';

const APPLY = process.argv.includes('--apply');
/** Apply a saved plan instead of asking again. See the note where it is read. */
const FROM_AT = process.argv.indexOf('--from');
const FROM = FROM_AT === -1 ? undefined : process.argv[FROM_AT + 1];
const PLAN = '/tmp/skill-categories.json';
const BATCH = 12;
/**
 * Look for ADDITIONAL parents on concepts that already have one.
 *
 * One parent per concept was never a decision, just what a per-entry prompt
 * produces — and it is wrong for most of the interesting entries. Playwright is
 * an end-to-end testing tool AND a scraping tool. MySQL is a database AND SQL.
 * Measured on dev: MySQL, MariaDB and SQLite each reached `Databases` and
 * nothing else, while PostgreSQL reached SQL only because it was added by hand,
 * which is exactly the inconsistency a human notices first when reading the
 * graph.
 */
const MORE = process.argv.includes('--more-parents');

/**
 * A closed list, so domains cannot sprawl into one-per-skill.
 *
 * "IT" is first because it is most of this vocabulary, and last is the escape
 * hatch: a domain the model cannot place is better left unrooted than forced.
 */
const DOMAINS = ['IT', 'Hospitality & Events', 'Languages', 'Business & Marketing'] as const;

/**
 * Standard categories offered even though they are not in the vocabulary yet.
 *
 * Invention is where the run-to-run variance lives. Measured across two runs of
 * the same prompt at temperature 0: one invented "Programming Languages",
 * "Cloud Platforms", "Web Servers" and "Shell scripting" and placed C#, Azure,
 * Caddy and Bash correctly under them; the next invented none of the four and
 * filed C#, Caddy and Celery under **Backend development** instead. Nothing
 * changed but which twelve entries shared a batch.
 *
 * Offering the list up front turns invention into selection, which is the part
 * a language model is reliable at. These are minted only if something is
 * actually placed under them, so an unused suggestion costs nothing.
 *
 * `Databases` earns its place twice over: without it the model reaches for
 * `Data Science` — and since SQL is itself a parent, that wrote
 * PostgreSQL → SQL → Data Science.
 */
const SEED_CATEGORIES = [
	'Programming languages',
	'Databases',
	'Cloud platforms',
	'Web servers',
	'Shell scripting',
	'Message queues',
	'Observability',
	'Container orchestration',
	'Infrastructure as code',
	'End-to-end testing',
	'Data formats',
	'Developer tools',
	'Design tools',
	'Authentication',
	'Template engines',
	'Knowledge representation',
	'Operating systems',
	'Web analytics'
] as const;

const Item = z.object({
	item: z.number().int().optional(),
	/**
	 * `skill` is the only kind that gets categorised.
	 *  - requirement: an eligibility condition — a degree level, a language
	 *    proficiency, a work permit, a years-of-experience floor.
	 *  - trait: a personality or work-style adjective.
	 *  - unclear: too vague to place. Left alone rather than guessed at.
	 */
	kind: z.enum(['skill', 'requirement', 'trait', 'unclear']),
	/** An existing concept where one fits, otherwise a new category to mint. */
	parent: z.string().optional(),
	domain: z.string().optional(),
	confidence: z.number().min(0).max(1).optional()
});

/** What the model is ASKED for; `coerceIndexedEnvelope` normalises what returns. */
const Schema = z.object({ items: z.array(Item) });

const SYSTEM = `You place each skill under a parent category.

FIRST decide what the entry is:
  skill        something a person can DO or a technology they can USE
  requirement  an eligibility condition: a degree or education level, a language
               proficiency, a work permit, a minimum number of years
  trait        a personality or work-style adjective: analytical, creative,
               service-oriented, communicative
  unclear      too vague to place confidently

Only entries you call "skill" get a parent. For the others, return the kind and
nothing else — do not invent a category for them.

For a skill, give:

  parent  the category that CONTAINS it, such that "having the skill implies
          working in the category". PostgreSQL -> SQL. Cypress -> E2E testing.
          Terraform -> Infrastructure as code. Kubernetes -> Container
          orchestration.
          PREFER a category marked [known] — reusing one joins two islands,
          while a new near-synonym creates a third. Next prefer one marked
          [suggested]. Invent a category ONLY when nothing offered fits, and
          spell it as a plain plural noun phrase if you do.
          The parent must be BROADER than the entry, never a sibling and never
          the same thing spelled differently. If the only parent you can think
          of is a restatement, return kind "skill" with no parent.

          THE TEST: "every X is a kind of Y". Not "X is used with Y", not "X is
          used for Y", not "X appears in Y projects". Those are the same mistake
          and it is the most common one made here:
            JSON -> APIs           WRONG. JSON is a format used by APIs.
            Redis -> Caching       WRONG. Redis is a store used for caching.
            SQL -> Data Science    WRONG. SQL is used in data science and in a
                                   hundred other things.
            Jira -> Agile          WRONG. Jira is a tool teams use to run Agile.
          When only a "used with" link exists, return kind "skill" with no
          parent. A missing edge costs a match; a wrong one corrupts every
          profile that walks through it.

  domain  one of: ${DOMAINS.join(', ')}. Omit if none fit.

When an entry shows [already under: ...], it HAS a category. Give a genuinely
DIFFERENT one it also belongs to, or return kind "skill" with no parent. Most
things have exactly one; the ones worth a second are those that live in two
worlds at once:
  MySQL       [already under: Databases]        -> SQL
  Playwright  [already under: End-to-end testing] -> Web Scraping
Do NOT restate the category it already has, name something broader than it, or
name something that category already implies.

confidence: 0-1.

Return ONE object with an "items" ARRAY, in input order, each carrying its index:

{"items":[{"item":0,"kind":"skill","parent":"SQL","domain":"IT","confidence":0.95},
          {"item":1,"kind":"trait","confidence":0.9}]}

Do NOT return an object keyed by index. "items" must be a JSON array.`;

interface Concept {
	id: number;
	slug: string;
	label: string;
}

async function main() {
	const concepts = await queryRawDirect<Concept>(
		sql`SELECT id, slug, label FROM skill_concepts ORDER BY label`
	);
	const idBySlug = new Map(concepts.map((c) => [c.slug, c.id]));

	// The work is every concept with no PARENT — not every concept with no edge.
	//
	// This started as "orphans only", on the reasoning that a concept already in
	// the graph has a reviewed place in it. That was wrong, and Django REST
	// Framework is the case that shows why: it has exactly one edge, `requires
	// Django`, so it counted as connected and was never considered — while
	// nothing in the graph said it is an API framework. A dependency is not a
	// category. Measured here: 45 concepts have an edge but no parent, 13 of them
	// with only a `requires` edge, and every one was invisible to the first run.
	//
	// Pending proposals count as having a parent too. Otherwise each run re-asks
	// about everything still sitting in the review queue, and the queue grows by
	// a duplicate of itself every time this is run.
	//
	// A REJECTED edge is not a parent. The retirement path keeps the row and only
	// nulls `approved_at`, so `JavaScript broader frontend` — retired for being a
	// non-implication — still read as "JavaScript has a parent" and hid the
	// concept from every run. `audit:` sources are exactly the rows a human or the
	// auditor decided against, so they are the ones that must not count.
	const parented = await queryRawDirect<{ id: number }>(sql`
		SELECT DISTINCT from_id AS id FROM skill_relations
		WHERE relation IN ('broader', 'covers')
		  AND (approved_at IS NOT NULL OR coalesce(source, '') NOT LIKE 'audit:%')
	`);
	const hasParent = new Set(parented.map((r) => r.id));

	/** What each concept is already under, so the prompt can ask for more. */
	const parentRows = await queryRawDirect<{ from_id: number; label: string }>(sql`
		SELECT r.from_id, t.label FROM skill_relations r
		JOIN skill_concepts t ON t.id = r.to_id
		WHERE r.approved_at IS NOT NULL AND r.relation IN ('broader', 'covers')
	`);
	const parentsOf = new Map<number, string[]>();
	for (const r of parentRows) {
		if (!parentsOf.has(r.from_id)) parentsOf.set(r.from_id, []);
		parentsOf.get(r.from_id)!.push(r.label);
	}

	// A concept worth offering as a parent is one the graph already uses as one:
	// anything with an approved edge in either direction. Minted-but-unapproved
	// categories are deliberately not offered — suggesting a category that no
	// human has accepted yet would compound one guess onto another.
	const connected = await queryRawDirect<{ id: number }>(sql`
		SELECT DISTINCT id FROM (
			SELECT from_id AS id FROM skill_relations WHERE approved_at IS NOT NULL
			UNION SELECT to_id FROM skill_relations WHERE approved_at IS NOT NULL
		) x
	`);
	const inGraph = new Set(connected.map((r) => r.id));
	// `--more-parents` inverts the selection: the work is what already HAS a
	// parent, and the question becomes "what else is it?" rather than "what is
	// it?".
	//
	// Categories used to be excluded here, on the reasoning that a category's
	// parent is a taxonomy decision rather than a fact about a skill. That was
	// wrong for the same reason "has an edge" was wrong for orphans: being a
	// parent of something does not stop you needing one. JavaScript is a category
	// — React and TypeScript are kinds of it — AND a programming language, and
	// being the first hid the second, so TypeScript sat under Programming
	// languages while JavaScript did not.
	const orphans = MORE
		? concepts.filter((c) => hasParent.has(c.id))
		: concepts.filter((c) => !hasParent.has(c.id));
	const offered = concepts.filter((c) => inGraph.has(c.id)).map((c) => c.label);

	console.log(
		`${concepts.length} concepts: ${orphans.length} ${MORE ? 'to re-examine' : 'without a parent'}, ` +
			`${offered.length} already in the graph and offered as parents.\n`
	);
	if (orphans.length === 0) return;

	type Decision = { child: Concept; parent: string; domain?: string; confidence: number };
	type Skip = { child: Concept; kind: string };

	async function place(items: Concept[], offer: string[], pass: string) {
		const decisions: Decision[] = [];
		const skipped: Skip[] = [];
		for (let i = 0; i < items.length; i += BATCH) {
			const batch = items.slice(i, i + BATCH);
			const listed = batch
				.map((c, n) => {
					const now = (parentsOf.get(c.id) ?? []).join(', ');
					return now ? `${n}. "${c.label}"  [already under: ${now}]` : `${n}. "${c.label}"`;
				})
				.join('\n');
			try {
				const res = await generateChatCompletionTracked(
					[
						{ role: 'system', content: SYSTEM },
						{
							role: 'user',
							content:
								`Categories already in the graph. Prefer these above all:\n` +
								offer.map((l) => `[known] ${l}`).join('\n') +
								`\n\nStandard categories not yet used here. Prefer these over inventing:\n` +
								SEED_CATEGORIES.map((l) => `[suggested] ${l}`).join('\n') +
								`\n\nPlace these ${batch.length} entries:\n\n${listed}`
						}
					],
					{ temperature: 0, structuredOutput: { name: 'skill_categories', schema: Schema } }
				);
				for (const { index, value: v } of coerceIndexedEnvelope(
					JSON.parse(res.content),
					'items',
					Item
				)) {
					const child = batch[v.item ?? index];
					if (!child) continue;
					const parent = v.parent?.trim();
					// A parent that normalizes to the child is the model restating the
					// entry, which would write a self-loop the audit then has to find.
					if (v.kind !== 'skill' || !parent || normalizeSkill(parent) === child.slug) {
						skipped.push({ child, kind: v.kind });
						continue;
					}
					const domain = DOMAINS.find((d) => d === v.domain);
					decisions.push({ child, parent, domain, confidence: v.confidence ?? 0.5 });
				}
				process.stdout.write(`  ${pass} batch ${Math.floor(i / BATCH) + 1}: done\n`);
			} catch (err) {
				console.warn(
					`  ${pass} batch ${Math.floor(i / BATCH) + 1} FAILED: ${err instanceof Error ? err.message : err}`
				);
			}
		}
		return { decisions, skipped };
	}

	// Two passes, because one is measurably inconsistent. A batch only ever sees
	// twelve entries, so the model invents "Amazon Web Services" for the batch
	// holding AWS S3 and then, three batches later, finds no parent for Azure —
	// and answers `skill` with no category rather than a wrong one, which is the
	// right failure but still a miss. Measured on the first run: 27 of 134 came
	// back as a skill it could not place, including MySQL while MariaDB had
	// already been put under SQL.
	//
	// So pass 2 re-asks exactly those, with pass 1's categories added to the
	// offered list. Nothing else is retried: a `trait` or `requirement` verdict
	// is an answer, not a failure.
	let decisions: Decision[];
	let skipped: Skip[];

	if (FROM) {
		// Apply what was actually reviewed, not a fresh answer to the same
		// question. temperature 0 is not determinism here: two consecutive runs of
		// this prompt placed 79 and 94 of the same 134 orphans, and disagreed about
		// where C#, Caddy and Bash belong. Reviewing one run and writing another is
		// not a review, so the plan is written to disk and applied from there.
		const saved = JSON.parse(readFileSync(FROM, 'utf-8')) as {
			decisions: Decision[];
			skipped: Skip[];
		};
		decisions = saved.decisions;
		skipped = saved.skipped;
		console.log(`loaded ${decisions.length} decision(s) from ${FROM} — no LLM call.\n`);
	} else {
		const pass1 = await place(orphans, offered, 'pass 1');
		const discovered = [...new Set(pass1.decisions.map((d) => d.parent))].filter(
			(p) => !offered.includes(p)
		);
		const unplaced = pass1.skipped.filter((s) => s.kind === 'skill').map((s) => s.child);
		console.log(
			`\npass 1 placed ${pass1.decisions.length}; ${unplaced.length} came back as an ` +
				`unplaceable skill. Retrying those against ${discovered.length} new categories.\n`
		);
		const pass2 =
			unplaced.length > 0
				? await place(unplaced, [...offered, ...discovered], 'pass 2')
				: { decisions: [] as Decision[], skipped: [] as Skip[] };

		decisions = [...pass1.decisions, ...pass2.decisions];
		skipped = [...pass1.skipped.filter((s) => s.kind !== 'skill'), ...pass2.skipped];
		writeFileSync(PLAN, JSON.stringify({ decisions, skipped }, null, '\t'));
	}

	// Refuse a parent that already reaches the child.
	//
	// `Software Architecture broader Software Design` is approved, and this run
	// proposed `Software Design broader Software Architecture` — a two-node cycle,
	// from a model that sees one entry at a time and cannot know the graph already
	// answers the question in the other direction. `expandUpward` would survive it
	// (the CTE is UNION, not UNION ALL) but every profile touching either concept
	// would silently gain the other, and the audit would report both edges as
	// redundant without saying why.
	//
	// Checked against APPROVED edges only: a pending proposal is not yet a fact,
	// and refusing on one would let a wrong proposal veto a right one.
	const upEdges = await queryRawDirect<{ from_id: number; to_id: number }>(sql`
		SELECT from_id, to_id FROM skill_relations
		WHERE approved_at IS NOT NULL AND relation IN ('broader', 'covers')
	`);
	const up = new Map<number, number[]>();
	for (const e of upEdges) {
		if (!up.has(e.from_id)) up.set(e.from_id, []);
		up.get(e.from_id)!.push(e.to_id);
	}
	function reachesUp(from: number, to: number): boolean {
		const seen = new Set([from]);
		const queue = [from];
		while (queue.length > 0) {
			for (const next of up.get(queue.shift()!) ?? []) {
				if (next === to) return true;
				if (seen.has(next)) continue;
				seen.add(next);
				queue.push(next);
			}
		}
		return false;
	}
	// A domain is never a `broader` parent.
	//
	// Asked for a second category, the model reaches for the widest word it can
	// see, and "IT" is the widest word in this vocabulary: one --more-parents run
	// proposed `X broader IT` for 23 concepts including Java, Linux and Redis.
	// Every one would assert domain membership as subsumption — the exact
	// confusion `inDomain` was introduced to keep out of MATCHING_RELATIONS — and
	// approving them would make any posting saying "IT" match almost this whole
	// vocabulary. The domain layer already says this, in the relation that is
	// drawn rather than walked.
	const domainAsParent = decisions.filter((d) =>
		DOMAINS.some((dom) => normalizeSkill(dom) === normalizeSkill(d.parent))
	);
	if (domainAsParent.length > 0) {
		console.log(`\nrefused ${domainAsParent.length} edge(s) naming a DOMAIN as a broader parent:`);
		for (const d of domainAsParent) console.log(`  ${d.child.label} -> ${d.parent}`);
		decisions = decisions.filter((d) => !domainAsParent.includes(d));
	}

	// Redundant is the other way round, and it matters most in --more-parents:
	// asked for a SECOND parent, the obvious answers are the ones the first
	// already implies. `MySQL broader Databases` is approved, so proposing
	// `MySQL broader Databases` again, or anything Databases already reaches,
	// adds a line to the picture and nothing to a match.
	const redundant = decisions.filter((d) => {
		const parentId = idBySlug.get(normalizeSkill(d.parent));
		return parentId !== undefined && reachesUp(d.child.id, parentId);
	});
	if (redundant.length > 0) {
		console.log(`\nskipped ${redundant.length} edge(s) already reachable:`);
		for (const r of redundant) console.log(`  ${r.child.label} -> ${r.parent}`);
		decisions = decisions.filter((d) => !redundant.includes(d));
	}

	const cyclic = decisions.filter((d) => {
		const parentId = idBySlug.get(normalizeSkill(d.parent));
		return parentId !== undefined && reachesUp(parentId, d.child.id);
	});
	if (cyclic.length > 0) {
		console.log(`\nrefused ${cyclic.length} edge(s) that would close a cycle:`);
		for (const c of cyclic) console.log(`  ${c.child.label} -> ${c.parent} (already reaches back)`);
		decisions = decisions.filter((d) => !cyclic.includes(d));
	}

	// Group by parent: the interesting unit of review is a category and everything
	// it would absorb, not one edge at a time.
	const byParent = new Map<string, typeof decisions>();
	for (const d of decisions) {
		const key = d.parent;
		if (!byParent.has(key)) byParent.set(key, []);
		byParent.get(key)!.push(d);
	}
	const sorted = [...byParent.entries()].sort((a, b) => b[1].length - a[1].length);

	console.log(
		`\n${decisions.length} of ${orphans.length} orphans placed, in ${sorted.length} categories:\n`
	);
	for (const [parent, kids] of sorted) {
		const isNew = !idBySlug.has(normalizeSkill(parent));
		const domain = kids.find((k) => k.domain)?.domain;
		console.log(
			`  ${parent}${isNew ? ' (new)' : ''}${domain ? ` · ${domain}` : ''} — ${kids.length}\n` +
				`      ${kids.map((k) => k.child.label).join(', ')}`
		);
	}

	const byKind = new Map<string, string[]>();
	for (const s of skipped) {
		if (!byKind.has(s.kind)) byKind.set(s.kind, []);
		byKind.get(s.kind)!.push(s.child.label);
	}
	console.log('\nNot categorised:');
	for (const [kind, labels] of [...byKind.entries()].sort()) {
		console.log(`  ${kind} (${labels.length}): ${labels.join(', ')}`);
	}

	if (!APPLY) {
		console.log(`\nDry run. Plan saved to ${PLAN}.`);
		console.log(`Apply exactly THIS plan with:  --apply --from ${PLAN}`);
		console.log('(--apply on its own asks the model again, and it will answer differently.)');
		return;
	}

	/** Mint on demand; a category the reviewer rejects is left reaching only itself. */
	async function conceptId(label: string): Promise<number | undefined> {
		const slug = normalizeSkill(label);
		if (!slug) return undefined;
		if (idBySlug.has(slug)) return idBySlug.get(slug);
		await db.execute(
			sql`INSERT INTO skill_concepts (slug, label) VALUES (${slug}, ${label}) ON CONFLICT (slug) DO NOTHING`
		);
		const [row] = await queryRawDirect<{ id: number }>(
			sql`SELECT id FROM skill_concepts WHERE slug = ${slug}`
		);
		if (row) idBySlug.set(slug, row.id);
		return row?.id;
	}

	let edges = 0;
	let rooted = 0;
	const before = idBySlug.size;

	for (const [parent, kids] of sorted) {
		const parentId = await conceptId(parent);
		if (!parentId) continue;
		for (const k of kids) {
			await db.execute(sql`
				INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
				VALUES (${k.child.id}, ${parentId}, 'broader', ${k.confidence}, 'llm:category')
				ON CONFLICT DO NOTHING
			`);
			edges++;
		}
		// The domain edge hangs off the CATEGORY, not off each skill: one edge per
		// category keeps the picture readable and says the same thing.
		const domain = kids.find((k) => k.domain)?.domain;
		if (!domain) continue;
		const domainId = await conceptId(domain);
		if (!domainId || domainId === parentId) continue;
		await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
			VALUES (${parentId}, ${domainId}, 'inDomain', 0.9, 'llm:category')
			ON CONFLICT DO NOTHING
		`);
		rooted++;
	}
	const minted = idBySlug.size - before;

	console.log(
		`\nminted ${minted} concept(s), wrote ${edges} unapproved broader edge(s) ` +
			`and ${rooted} inDomain edge(s).`
	);
	console.log('Review at /admin/skill-ontology — nothing matches until you do.');
	console.log('inDomain is not in MATCHING_RELATIONS: it draws, it never affects a match.');
}

await main();
process.exit(0);
