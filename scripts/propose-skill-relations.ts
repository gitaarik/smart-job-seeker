/**
 * Populate the skill ontology: embeddings propose pairs, an LLM types them and
 * commits to a DIRECTION, nothing is approved.
 *
 * The division of labour is the point. Cosine is good at "these two are
 * related" and structurally incapable of "which implies which" — it returns one
 * number for an unordered pair. So it does the cheap half (candidate
 * generation) and one structured-output call does the half it cannot.
 *
 *   docker compose exec -T -e SJS_LLM_API_KEY_GROQ=… -e SJS_LLM_API_KEY_GEMINI=… \
 *     -e SJS_EMBEDDING_ENABLED=true app npx tsx scripts/propose-skill-relations.ts [--limit N] [--apply]
 *
 * Without `--apply` it prints what it would write and touches nothing.
 *
 * ## Nothing here approves anything
 *
 * Rows land with `approved_at` null and `expandUpward` does not traverse them.
 * A wrong edge is invisible and global — it changes every future match for
 * every profile and nothing surfaces it — so the promotion step is separate and
 * deliberate. See planning/SKILL-ONTOLOGY.md.
 */
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { generateChatCompletionTracked } from '../src/lib/server/llm/langchain';
import { normalizeSkill } from '../src/lib/skills';
import { MAX_DEPTH } from '../src/lib/server/job/skill-ontology';
import { cosineSimilarity } from '../src/lib/server/llm/embeddings';
import { coerceIndexedEnvelope } from '../src/lib/server/llm/structured-envelope';

const APPLY = process.argv.includes('--apply');
/**
 * Also persist `related` verdicts.
 *
 * Off by default because `related` is symmetric and MUST NOT reach matching —
 * `MATCHING_RELATIONS` excludes it, and admitting it there puts the false
 * positives straight back. It is walked by exactly one traversal,
 * `expandForRetrieval`, one hop and non-composing.
 *
 * They were counted and discarded until now, which is why the graph holds 339
 * `broader` edges and 8 `related` ones: the model has been answering this
 * question all along and the answers went in the bin. Gap analysis — "one hop
 * from what they asked for", Docker when the posting says Kubernetes — is the
 * use the ontology docstring reserved for them, and it needs supply.
 */
const WITH_RELATED = process.argv.includes('--with-related');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 400;

/**
 * Candidate floor, deliberately BELOW the 0.68 matching threshold.
 *
 * This is a different question. 0.68 is "close enough to count as the same
 * requirement" — a decision. This is "close enough to be worth asking about" —
 * a shortlist, where the LLM makes the decision and `none` is a perfectly good
 * answer. Too low and it drowns in the noise floor the config.ts comment
 * documents (unrelated skills sit at a median ~0.51-0.54), so 0.60 sits above
 * that and below the decision line.
 */
const CANDIDATE_FLOOR = 0.6;
/** Per skill, best-first. A hiring vocabulary has a few real ancestors, not thirty. */
const CANDIDATES_PER_SKILL = 6;
/** Pairs per LLM call. Large enough to be cheap, small enough not to lose track. */
const BATCH = 12;

/**
 * Lenient on purpose. Observed from the configured model on the first run:
 *
 *  - the envelope came back as a KEYED OBJECT (`{"0": {...}, "1": {...}}`)
 *    rather than `{verdicts: [...]}`, dropping `pair` and using the key as the
 *    index;
 *  - `from` came back `null` on every `related` verdict, which is the sensible
 *    answer to "which side is the specific one" when neither is.
 *
 * Both are reasonable readings of the task and neither is worth another round
 * trip to correct, so the schema accepts them and `coerceIndexedEnvelope`
 * normalises the envelope. A schema is a contract with a model that did not
 * sign it — see
 * planning/SKILL-ONTOLOGY.md and the gpt-oss structured-output notes.
 */
const VerdictItem = z.object({
	pair: z.number().int().optional(),
	/**
	 * `broader`  — the `from` side is a KIND OF the other.
	 * `requires` — the `from` side cannot be used without the other.
	 * `related`  — genuinely associated, neither implies the other.
	 * `alias`    — two spellings of the SAME skill; `from` is the variant.
	 * `none`     — no useful relation.
	 */
	relation: z.enum(['broader', 'requires', 'related', 'alias', 'none']),
	/** Which side is the specific/dependent one. Null is fine for related/none. */
	from: z.enum(['a', 'b']).nullable().optional(),
	confidence: z.number().min(0).max(1).optional()
});

/** What the model is ASKED for. What it returns is normalised by `coerceIndexedEnvelope`. */
const VerdictSchema = z.object({ verdicts: z.array(VerdictItem) });

const SYSTEM = `You classify the relationship between two software skills.

For each pair you return one verdict. The DIRECTION is the whole point of this
task — get it right and the rest does not matter much; get it wrong and the
result is worse than useless.

relation:
- "broader": one skill is a KIND OF the other. React is a kind of JavaScript
  framework. PostgreSQL is a kind of SQL database.
- "requires": one skill CANNOT BE USED WITHOUT the other, but is not a kind of
  it. Django requires Python. Django is not a kind of Python.
- "related": the two are ALTERNATIVES — someone picks one INSTEAD OF the other
  for the same job. Docker and Kubernetes. React and Vue. MariaDB and MySQL.
  Skills merely used TOGETHER, or merely from one vendor or family, are "none":
  AWS Lambda and AWS S3 are both AWS and are used side by side, so neither
  stands in for the other and "both are AWS" is already recorded elsewhere.
  Ask "could one stand in for the other?", not "do they go together?".
- "alias": the two strings name the SAME skill. An acronym and its expansion
  ("RAG" / "Retrieval Augmented Generation"), or a spelling variant ("NodeJS" /
  "Node.js"). NOT two different skills that often appear together.
- "none": no useful relation. Python and communication.

from: which side is the SPECIFIC or DEPENDENT one — the side that implies the
other. Set it to "a" or "b".

  a="React", b="JavaScript"  -> relation "broader", from "a"
  a="JavaScript", b="React"  -> relation "broader", from "b"

Both of those describe the SAME fact. Order of presentation must not change the
answer: decide which skill implies which, then say so.

The test to apply: "if someone has done "from", have they necessarily done the
other one?" If yes, it is broader or requires. If they might not have, it is
"related" when the two are alternatives, and "none" otherwise.

Two skills that are alternatives to each other are NEVER broader — neither
React nor Vue implies the other, and they are NOT aliases: they are different
things. Reserve "alias" for one skill written two ways.

For "alias", set "from" to the ABBREVIATED or less formal spelling — the full
form is the one worth keeping as the name:

  a="RAG", b="Retrieval Augmented Generation" -> relation "alias", from "a"

confidence: 0-1, how sure you are — of the direction as much as the relation.

Return ONE object with a "verdicts" ARRAY, in the same order as the input, each
carrying the index it answers:

{"verdicts":[{"pair":0,"relation":"broader","from":"a","confidence":0.9},
             {"pair":1,"relation":"related","from":null,"confidence":0.8}]}

Do NOT return an object keyed by index. "verdicts" must be a JSON array.`;

interface Pair {
	i: number;
	a: string;
	b: string;
	cosine: number;
}

/** The vocabulary worth modelling: the applicant's skills, and what jobs asked of them. */
async function vocabulary(): Promise<string[]> {
	const rows = await queryRawDirect<{ name: string }>(sql`
		SELECT DISTINCT trim(name) AS name FROM tech_skills WHERE name IS NOT NULL AND trim(name) <> ''
		UNION
		SELECT DISTINCT trim(s) AS name
		FROM applications a
		JOIN jobs j ON j.id = a.job_id,
		     LATERAL json_array_elements_text(
		       CASE WHEN json_typeof(j.skills_required) = 'array'
		            THEN j.skills_required ELSE '[]'::json END
		     ) s
		WHERE trim(s) <> ''
	`);
	return rows.map((r) => r.name);
}

async function main() {
	const vocab = await vocabulary();
	const bySlug = new Map<string, string>();
	for (const name of vocab) {
		const slug = normalizeSkill(name);
		// First spelling wins as the label; they are the same concept either way.
		if (slug && !bySlug.has(slug)) bySlug.set(slug, name);
	}
	console.log(`vocabulary: ${bySlug.size} distinct concepts from ${vocab.length} names`);

	// Vectors already cached by the shipped expansion path — this reads them,
	// it does not embed anything new.
	const vectors = await queryRawDirect<{ skill: string; embedding: number[] }>(sql`
		SELECT skill, embedding FROM skill_embeddings
	`);
	const vecBySlug = new Map<string, number[]>();
	for (const v of vectors) {
		const slug = normalizeSkill(v.skill);
		if (bySlug.has(slug) && !vecBySlug.has(slug)) vecBySlug.set(slug, v.embedding as number[]);
	}
	console.log(`vectors available for ${vecBySlug.size} of them`);

	const slugs = [...vecBySlug.keys()];
	const seen = new Set<string>();
	const pairs: Pair[] = [];
	for (const a of slugs) {
		const scored: [string, number][] = [];
		for (const b of slugs) {
			if (a === b) continue;
			const sim = cosineSimilarity(vecBySlug.get(a)!, vecBySlug.get(b)!);
			if (sim >= CANDIDATE_FLOOR) scored.push([b, sim]);
		}
		scored.sort((x, y) => y[1] - x[1]);
		for (const [b, sim] of scored.slice(0, CANDIDATES_PER_SKILL)) {
			// One verdict per unordered pair — the LLM is asked which way it goes,
			// so asking twice would just invite it to contradict itself.
			const key = a < b ? `${a}|${b}` : `${b}|${a}`;
			if (seen.has(key)) continue;
			seen.add(key);
			pairs.push({ i: pairs.length, a: bySlug.get(a)!, b: bySlug.get(b)!, cosine: sim });
		}
	}
	console.log(`candidate pairs above ${CANDIDATE_FLOOR}: ${pairs.length}, taking ${LIMIT}\n`);

	const work = pairs.slice(0, LIMIT);
	const verdicts: { pair: Pair; relation: string; from: 'a' | 'b'; confidence: number }[] = [];

	for (let i = 0; i < work.length; i += BATCH) {
		const batch = work.slice(i, i + BATCH);
		const listed = batch.map((p, n) => `${n}. a="${p.a}"  b="${p.b}"`).join('\n');
		try {
			// The TRACKED variant, deliberately: `generateChatCompletion` validates
			// against the schema itself and throws before a caller can see the body.
			// The whole point here is to accept a shape the model actually returns,
			// so the raw content has to reach `coerceIndexedEnvelope`.
			const res = await generateChatCompletionTracked(
				[
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: `Classify these ${batch.length} pairs:\n\n${listed}` }
				],
				{
					temperature: 0,
					structuredOutput: { name: 'skill_relations', schema: VerdictSchema }
				}
			);
			const items = coerceIndexedEnvelope(JSON.parse(res.content), 'verdicts', VerdictItem);
			for (const { index, value: v } of items) {
				const p = batch[v.pair ?? index];
				// A directional verdict with no direction is unusable — drop it rather
				// than guess, since guessing is the one failure this table exists to
				// prevent.
				if (!p) continue;
				if ((v.relation === 'broader' || v.relation === 'requires') && !v.from) continue;
				verdicts.push({
					pair: p,
					relation: v.relation,
					from: v.from ?? 'a',
					confidence: v.confidence ?? 0.5
				});
			}
			process.stdout.write(`  batch ${i / BATCH + 1}: ${items.length} verdicts\n`);
		} catch (err) {
			console.warn(`  batch ${i / BATCH + 1} FAILED: ${err instanceof Error ? err.message : err}`);
		}
	}

	const useful = verdicts.filter((v) => v.relation === 'broader' || v.relation === 'requires');
	const aliases = verdicts.filter((v) => v.relation === 'alias');
	const relatedAll = WITH_RELATED ? verdicts.filter((v) => v.relation === 'related') : [];

	// Drop `related` where the graph ALREADY records an implication between the two,
	// in either direction and at any depth. `Code review related Software Design`
	// arrived while `Code review broader Software Design` was approved: the second
	// says one implies the other, the first says neither does, and both were in the
	// queue at once. That is not a judgement call, it is the graph contradicting
	// itself, so it is refused here rather than shown to a reviewer.
	//
	// Note what this deliberately does NOT do: drop every pair sharing a parent.
	// Two concepts under one parent are the case `related` EXISTS for when they are
	// alternatives (Azure DevOps and GitLab CI/CD, both under CI/CD), and no query
	// tells an alternative apart from a mere co-occurrence. The co-occurrence half
	// (AWS Lambda and AWS S3, both AWS and used side by side) is headed off in the
	// prompt instead, where the distinction can actually be stated.
	const ancestry = await queryRawDirect<{ child: string; anc: string }>(sql`
		WITH RECURSIVE up AS (
			SELECT from_id AS child, to_id AS anc, 1 AS d
			FROM skill_relations
			WHERE relation IN ('broader', 'requires', 'covers') AND approved_at IS NOT NULL
			UNION
			SELECT u.child, r.to_id, u.d + 1
			FROM up u
			JOIN skill_relations r ON r.from_id = u.anc
			WHERE r.relation IN ('broader', 'requires', 'covers')
			  AND r.approved_at IS NOT NULL
			  AND u.d < ${MAX_DEPTH}
		)
		SELECT c.slug AS child, a.slug AS anc
		FROM up u
		JOIN skill_concepts c ON c.id = u.child
		JOIN skill_concepts a ON a.id = u.anc
	`);
	const implies = new Set(ancestry.map((r) => `${r.child}|${r.anc}`));
	const alreadyImplied = (a: string, b: string) => {
		const [x, y] = [normalizeSkill(a), normalizeSkill(b)];
		return implies.has(`${x}|${y}`) || implies.has(`${y}|${x}`);
	};
	const related = relatedAll.filter((v) => !alreadyImplied(v.pair.a, v.pair.b));
	const contradictory = relatedAll.length - related.length;
	console.log(
		`\n${verdicts.length} verdicts; ${useful.length} directional ` +
			`(${verdicts.filter((v) => v.relation === 'related').length} related, ` +
			`${verdicts.filter((v) => v.relation === 'none').length} none)`
	);
	if (contradictory > 0) {
		console.log(
			`  ${contradictory} related pair(s) skipped: the graph already implies one from the other`
		);
	}

	for (const v of useful.slice(0, 25)) {
		const from = v.from === 'a' ? v.pair.a : v.pair.b;
		const to = v.from === 'a' ? v.pair.b : v.pair.a;
		console.log(`  ${from} —${v.relation}→ ${to}  (${v.confidence.toFixed(2)})`);
	}
	if (useful.length > 25) console.log(`  … and ${useful.length - 25} more`);

	if (related.length > 0) {
		console.log(`\n${related.length} related pair(s) — gap analysis only, never matching:`);
		for (const v of related.slice(0, 15)) {
			console.log(`  ${v.pair.a} ~ ${v.pair.b}`);
		}
		if (related.length > 15) console.log(`  … and ${related.length - 15} more`);
	}

	if (aliases.length > 0) {
		console.log(`\n${aliases.length} alias pair(s):`);
		for (const v of aliases.slice(0, 15)) {
			const variant = v.from === 'a' ? v.pair.a : v.pair.b;
			const canonical = v.from === 'a' ? v.pair.b : v.pair.a;
			console.log(`  "${variant}" = "${canonical}"`);
		}
		if (aliases.length > 15) console.log(`  … and ${aliases.length - 15} more`);
	}

	if (!APPLY) {
		console.log('\nDry run. Pass --apply to write concepts and UNAPPROVED relations.');
		process.exit(0);
	}

	for (const [slug, label] of bySlug) {
		await db.execute(
			sql`INSERT INTO skill_concepts (slug, label) VALUES (${slug}, ${label}) ON CONFLICT (slug) DO NOTHING`
		);
	}
	let written = 0;
	for (const v of useful) {
		const from = normalizeSkill(v.from === 'a' ? v.pair.a : v.pair.b);
		const to = normalizeSkill(v.from === 'a' ? v.pair.b : v.pair.a);
		if (from === to) continue;
		await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
			SELECT f.id, t.id, ${v.relation}, ${v.confidence}, 'llm'
			FROM skill_concepts f, skill_concepts t
			WHERE f.slug = ${from} AND t.slug = ${to}
			ON CONFLICT DO NOTHING
		`);
		written++;
	}
	// `related` is symmetric, so ONE row per unordered pair, ordered
	// lexicographically. The model returns `from: null` here — the sensible answer
	// to "which side is the specific one" when neither is — and `expandForRetrieval`
	// walks the edge in both directions anyway, so storing a second row would only
	// be a duplicate the audit would later have to call redundant.
	let relatedWritten = 0;
	for (const v of related) {
		const [from, to] = [normalizeSkill(v.pair.a), normalizeSkill(v.pair.b)].sort();
		if (!from || !to || from === to) continue;
		await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
			SELECT f.id, t.id, 'related', ${v.confidence}, 'llm'
			FROM skill_concepts f, skill_concepts t
			WHERE f.slug = ${from} AND t.slug = ${to}
			ON CONFLICT DO NOTHING
		`);
		relatedWritten++;
	}

	// Aliases point the VARIANT at the concept keeping the fuller name. Both
	// already exist as concepts — every distinct string became one — and that is
	// left alone deliberately: merging concepts is destructive and the traversal
	// does not need it, because `expandUpward` seeds from slug AND alias, so the
	// variant reaches the canonical concept's ancestors either way.
	let aliased = 0;
	for (const v of aliases) {
		const variant = normalizeSkill(v.from === 'a' ? v.pair.a : v.pair.b);
		const canonical = normalizeSkill(v.from === 'a' ? v.pair.b : v.pair.a);
		if (!variant || !canonical || variant === canonical) continue;
		await db.execute(sql`
			INSERT INTO skill_aliases (concept_id, alias, source)
			SELECT c.id, ${variant}, 'llm'
			FROM skill_concepts c
			WHERE c.slug = ${canonical}
			ON CONFLICT (alias) DO NOTHING
		`);
		aliased++;
	}

	console.log(
		`\nWrote ${bySlug.size} concepts, ${written} UNAPPROVED relations, ` +
			`${relatedWritten} UNAPPROVED related edges, ${aliased} UNAPPROVED aliases.`
	);
	console.log('Nothing influences matching until approved.');
	process.exit(0);
}

await main();
