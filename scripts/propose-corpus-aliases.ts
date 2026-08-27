/**
 * Guess what the corpus's unrecognised skill phrases mean, using concept
 * vectors — the automated half of `propose-corpus-gaps.ts`.
 *
 *   docker compose exec -T -e SJS_EMBEDDING_ENABLED=true \
 *     -e SJS_LLM_API_KEY_GEMINI="$SJS_LLM_API_KEY_GEMINI" \
 *     app npx tsx scripts/propose-corpus-aliases.ts [--limit N] [--apply]
 *
 * Without `--apply` it prints the ranked guesses and touches nothing.
 *
 * ## Why vectors are back, in this one place
 *
 * They were retired from the match path on 2026-08-26 and should stay retired:
 * cosine is symmetric, so it cannot tell "Django implies Python" from the
 * reverse, and the graph found every true positive it did (`match-utils.ts`).
 *
 * This asks a different question. Not "does A imply B" — a directional claim
 * cosine has no way to make — but "which concept is this phrase NAMING", which
 * is exactly the unordered similarity cosine measures. Direction still comes
 * from the graph afterwards, untouched. The vector only picks the door.
 *
 * It is also a RANKING, not a threshold. The retired layer had to decide
 * "≥ 0.74 or not" on every pair, and the measured bands do not separate:
 * `mysql`/`sql` sits at 0.739 and `mysql`/`python` at 0.618, with paraphrases
 * ("Mastery of SQL" → SQL, 0.710) scattered through the middle. Asking instead
 * which of 307 concepts is CLOSEST needs no such line — SQL wins that phrase
 * comfortably, at a score no threshold would have admitted.
 *
 * ## Nothing here approves anything
 *
 * Rows land with `approved_at` null and `expandUpward` does not traverse them.
 * That gate is doing more work here than in the sibling proposers, because the
 * guesses are unsupervised: an alias makes one concept answer for another
 * everywhere, in both directions, with no traversal left to inspect. The
 * measured failure modes are in `GUARDS` below, and the ones that survive the
 * guards still need a person.
 *
 *   npx tsx scripts/approve-skill-relations.ts --aliases    # list, then --approve <id…>
 *
 * ## Two stages, because one is not enough
 *
 * Cosine shortlists; a structured LLM call types what it shortlisted. The first
 * run measured the vector stage alone and roughly two thirds of what it liked
 * were siblings (`DynamoDB` → CosmosDB) or parents (`Deep Learning` → Machine
 * Learning) rather than aliases — see the note on `VerdictItem` for the
 * numbers. That is the same wall as the match path: "names the same thing", "is
 * a kind of that thing" and "is a rival to that thing" all look alike to a
 * similarity measure. `--no-llm` runs the vector stage alone, which is how that
 * was measured and how it should be re-measured.
 *
 * ## What this deliberately does not do
 *
 * Propose CONCEPTS. When a phrase names a real skill the graph lacks, the
 * answer is a concept plus a `broader` edge, not an alias — aliasing it would
 * hand it a chain it has no claim to. Those come back as the `narrower` reject
 * bucket, which is a reading list for `propose-corpus-gaps.ts`, where a human
 * writes the concept down.
 *
 * Run at match time. Nothing here is on a request path. The cost of that is
 * that a phrasing scraped tomorrow is not covered until the next run; the
 * benefit is that a wrong guess is caught in a review list rather than silently
 * mismatching every applicant who holds the skill.
 */
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { normalizeSkill, splitCompoundSkill } from '../src/lib/skills';
import { config } from '../src/lib/server/config';
import {
	cosineSimilarity,
	isEmbeddingConfigured,
	truncateVector
} from '../src/lib/server/llm/embeddings';
import { backfillSkillVocabulary } from '../src/lib/server/job/skill-embeddings';
import { generateChatCompletionTracked } from '../src/lib/server/llm/langchain';
import { coerceIndexedEnvelope } from '../src/lib/server/llm/structured-envelope';

/**
 * A parameterised `IN (…)` list — the same workaround `skill-ontology.ts` and
 * `propose-corpus-gaps.ts` carry, and for the same reason: drizzle interpolates
 * a JS array as a placeholder list rather than a Postgres array literal, so
 * `= ANY(${arr})` fails with "op ANY/ALL (array) requires array on right side".
 */
function inList(values: string[]): SQL {
	return sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SOURCE = 'corpus-vector';

function numArg(flag: string, fallback: number): number {
	const i = args.indexOf(flag);
	const v = i > -1 ? Number(args[i + 1]) : NaN;
	return Number.isFinite(v) ? v : fallback;
}

/** How many uncovered phrases to score, most-asked-for first. */
const LIMIT = numArg('--limit', 200);
/** Below this many mentions a phrase is not worth a reviewer's attention. */
const MIN_MENTIONS = numArg('--min-mentions', 2);

/**
 * The two knobs, and an honest note on where they came from.
 *
 * These are NOT measured constants like `embeddingSkillThreshold`, which has an
 * eval behind it. They are starting points chosen from a handful of SQL-family
 * phrases scored against four concepts, which is not a measurement. The dry run
 * prints `top1`, `top2` and `margin` for every candidate INCLUDING the rejected
 * ones precisely so the first real run replaces these numbers with evidence.
 *
 * `FLOOR` is the noise line: unrelated skills sit at a median ~0.51-0.54 (p99
 * ~0.63) per `config.ts`, so anything under this is the argmax of nothing.
 *
 * `MARGIN` is the one that matters. A ranking is only trustworthy when the
 * winner is clear — "experience with MSSQL" picks SQL at 0.657 with PostgreSQL
 * 0.012 behind, and a coin-flip between two wrong-ish answers is not a guess
 * worth writing down.
 */
const FLOOR = numArg('--floor', 0.65);
const MARGIN = numArg('--margin', 0.05);

/**
 * Past this many words it is prose, not a name for a concept.
 *
 * The corpus is overwhelmingly short — 82.4% of skill mentions are 1-2 words,
 * 11.4% are 3-4 — because `skills_required` is LLM-extracted rather than
 * scraped, and the extraction already collapses "Strong SQL experience" to
 * "SQL". What is left in the tail is genuinely prose: "10+ years' experience in
 * technical consulting, technical consultative selling, or related
 * technical/sales/industry experience" is a sentence, and no concept is its
 * name. Cosine will still rank something first.
 */
const MAX_WORDS = numArg('--max-words', 5);

/** Candidates per LLM call. Same size `propose-skill-relations.ts` settled on. */
const BATCH = 12;
/** Score and print the vector stage alone, without typing it. Measurement only. */
const NO_LLM = args.includes('--no-llm');

/**
 * What the model decides, and why the vector cannot.
 *
 * The first run of this script scored the vector stage alone and the answer was
 * unambiguous: of 33 candidates it liked, roughly a third were real aliases and
 * the rest were the two mistakes cosine structurally cannot avoid.
 *
 *   siblings   DynamoDB → CosmosDB (0.756), Canva → Figma (0.705),
 *              SAS → Sass (0.756 — a spelling collision, two unrelated tools)
 *   parents    Deep Learning → Machine Learning (0.789), .NET → C# (0.711),
 *              Generative AI → AI/ML (0.739)
 *
 * Every one of those scores ABOVE real aliases like `AI (Artificial
 * Intelligence)` → AI (0.756). They are not separable by any threshold, because
 * "names the same thing", "is a kind of that thing" and "is a rival to that
 * thing" all read as "is about that thing" to a similarity measure. This is the
 * same wall that retired the layer from the match path, met again one level up.
 *
 * So the division of labour is the one `propose-skill-relations.ts` established:
 * cosine does candidate generation, which it is good at, and one structured
 * call does the half it cannot. `other` is a perfectly good answer and most
 * candidates get it.
 */
const Verdict = z.enum(['alias', 'narrower', 'other']);

/**
 * Lenient on purpose, in the two ways the configured model was observed to be.
 *
 * Asked for `{verdicts:[{item,verdict}]}` it returned, on the first real run:
 *
 *   {"0":"alias","1":"narrower","2":"other", …}
 *
 * — both the index-keyed envelope `coerceIndexedEnvelope` already exists to
 * absorb, AND each item collapsed from an object to the bare value. The second
 * is a quirk of THIS schema rather than of the model: one meaningful field, so
 * `{verdict:"alias"}` and `"alias"` carry identical information and the shorter
 * one is a fair reading. Padding the object with fields it does not need, to
 * stop it collapsing, would be writing the schema for the parser instead of the
 * task.
 *
 * So the item accepts either, and the envelope is `loose` with `verdicts`
 * optional — the leniency has to sit HERE because `generateChatCompletionTracked`
 * validates against this schema and throws before the raw body reaches
 * `coerceIndexedEnvelope`. A schema is a contract with a model that did not sign
 * it; see planning/SKILL-ONTOLOGY.md and the gpt-oss structured-output notes.
 *
 * `alias`    — the phrase NAMES the concept; a spelling or wording variant.
 * `narrower` — a real skill of its own that sits UNDER the concept. Not an
 *              alias: it wants a concept plus a `broader` edge, which is a
 *              judgement call and belongs in `propose-corpus-gaps.ts`.
 * `other`    — a sibling, a rival, a coincidence of spelling, or unrelated.
 */
const VerdictItem = z.preprocess(
	(v) => (typeof v === 'string' ? { verdict: v } : v),
	z.object({
		item: z.number().int().optional(),
		verdict: Verdict,
		confidence: z.number().min(0).max(1).optional()
	})
);

/** What the model is ASKED for; `coerceIndexedEnvelope` normalises what returns. */
const VerdictSchema = z.looseObject({ verdicts: z.array(VerdictItem).optional() });

const SYSTEM = `You decide whether a phrase taken from a job posting is just another
way of writing a skill we already know, or something else.

For each item you get PHRASE (what an employer wrote) and CONCEPT (a skill in our
vocabulary). Return one verdict.

- "alias": the phrase NAMES that concept. A spelling variant ("Postgres" /
  "PostgreSQL"), an acronym or its expansion ("AI (Artificial Intelligence)" /
  "AI"), a qualifier wrapped around it ("Mastery of SQL" / "SQL"), or a
  pluralisation ("NoSQL databases" / "NoSQL"). Someone who has the concept has
  the phrase, and someone who has the phrase has the concept. Same thing, two
  wordings.

- "narrower": a REAL, DIFFERENT skill that happens to sit under the concept.
  "Deep Learning" is not another word for "Machine Learning" — it is a kind of
  it. "PySpark" is not "Apache Spark". Someone who knows the concept does NOT
  necessarily know the phrase.

- "other": everything else. Two rival tools ("DynamoDB" / "CosmosDB", "Canva" /
  "Figma"), two skills that merely occur together ("MLOps" / "DevOps"), two
  different disciplines that sound alike ("Product Management" / "Project
  management"), or an accident of spelling ("SAS" the statistics package /
  "Sass" the CSS preprocessor).

The test for "alias": could you swap one for the other in a job posting and
change nothing about who qualifies? If not, it is not an alias.

Be strict. "other" is the right answer more often than not, and a wrong alias is
the most expensive mistake available here — it makes one skill answer for
another for every applicant, in both directions, permanently.`;

/** Every skill string in the corpus, with its most common spelling and count. */
const CORPUS = sql`
	WITH m AS (
		SELECT trim(s) AS raw FROM jobs,
			LATERAL json_array_elements_text(skills_required) AS s
		WHERE json_typeof(skills_required) = 'array'
		UNION ALL
		SELECT trim(s) FROM jobs,
			LATERAL json_array_elements_text(skills_preferred) AS s
		WHERE json_typeof(skills_preferred) = 'array'
	)
	SELECT regexp_replace(lower(raw), '[^a-z0-9+#]', '', 'g') AS key,
	       count(*)::int AS n,
	       mode() WITHIN GROUP (ORDER BY raw) AS label
	FROM m WHERE raw <> '' GROUP BY 1
`;

/**
 * Every string the graph can already resolve. Shared with `coverage()` so that
 * "what counts as covered" and "what this batch would add" cannot drift apart —
 * the same arrangement `propose-corpus-gaps.ts` uses, and for the same reason.
 */
const KNOWN = sql`
	SELECT slug AS k FROM skill_concepts
	UNION SELECT regexp_replace(lower(label), '[^a-z0-9+#]', '', 'g') FROM skill_concepts
	UNION SELECT alias FROM skill_aliases WHERE approved_at IS NOT NULL
`;

/** Share of skill MENTIONS the graph resolves — not of distinct strings. */
async function coverage(): Promise<{ pct: number; covered: number; total: number }> {
	const [row] = await queryRawDirect<{ covered: number; total: number }>(sql`
		WITH freq AS (${CORPUS}), known AS (${KNOWN})
		SELECT COALESCE(sum(n) FILTER (WHERE key IN (SELECT k FROM known)), 0)::int AS covered,
		       COALESCE(sum(n), 0)::int AS total
		FROM freq
	`);
	const { covered, total } = row ?? { covered: 0, total: 0 };
	return { pct: total ? (covered / total) * 100 : 0, covered, total };
}

interface Phrase {
	key: string;
	label: string;
	n: number;
}

/** The most-asked-for strings the graph cannot resolve. */
async function uncovered(): Promise<Phrase[]> {
	const rows = await queryRawDirect<{ key: string; label: string; n: number }>(sql`
		WITH freq AS (${CORPUS}), known AS (${KNOWN})
		SELECT key, label, n FROM freq
		WHERE key NOT IN (SELECT k FROM known) AND n >= ${MIN_MENTIONS}
		ORDER BY n DESC, key
		LIMIT ${LIMIT}
	`);
	return rows.map((r) => ({ key: r.key, label: r.label, n: Number(r.n) }));
}

/** Why a candidate was not written. Ordered cheapest-check-first. */
type Reject =
	| 'compound' // names several concepts; an alias names one
	| 'prose' // longer than MAX_WORDS
	| 'is-concept' // the key is already a concept slug — aliasing it is audit defect 1
	| 'no-vector' // nothing to compare
	| 'below-floor' // the argmax of noise
	| 'ambiguous' // top1 and top2 within MARGIN
	| 'narrower' // a real skill under the concept — wants a concept, not an alias
	| 'not-alias'; // the model says sibling, rival or coincidence

const GUARDS: Record<Reject, string> = {
	compound: 'names several concepts — wants a split, not an alias',
	prose: `longer than ${MAX_WORDS} words — a sentence, not a name`,
	'is-concept': 'already a concept slug — an alias here is a duplicate concept',
	'no-vector': 'no embedding available',
	'below-floor': `nearest concept below ${FLOOR} — argmax of noise`,
	ambiguous: `top two within ${MARGIN} — a coin flip between two answers`,
	narrower: 'a real skill UNDER the concept — wants its own concept + broader edge',
	'not-alias': 'sibling, rival or spelling coincidence'
};

interface Scored {
	phrase: Phrase;
	best?: { slug: string; label: string; sim: number };
	runnerUp?: { label: string; sim: number };
	/** Does the winning concept's name appear inside the phrase? Review signal. */
	literal: boolean;
	verdict?: 'alias' | 'narrower' | 'other';
	reject?: Reject;
}

function words(s: string): number {
	return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The third envelope shape, on top of the two `coerceIndexedEnvelope` absorbs.
 *
 * Observed on the run after the item-collapse fix: the model renamed the
 * property, returning `{"results":["other","alias",…]}` where the schema and the
 * prompt both say `verdicts`. Two batches of three died on it, and the cost was
 * not a missing answer — it was `Postgres → PostgreSQL`, a correct alias at
 * 0.840, landing in the `not-alias` bucket because a failed batch is rejected
 * wholesale. A parse failure that reads as a verdict is the worst shape of bug
 * available here, so the key is treated as noise.
 *
 * Unwraps any single array-valued property, and a bare top-level array, onto the
 * expected key. The index-keyed object form is left alone for the helper's
 * second branch. Kept local rather than pushed into the shared helper because
 * that one is load-bearing for `propose-skill-relations.ts`; if a second caller
 * meets this, hoist it there with its tests.
 */
function envelope(raw: unknown): unknown {
	if (Array.isArray(raw)) return { verdicts: raw };
	if (raw && typeof raw === 'object') {
		const arrays = Object.values(raw as Record<string, unknown>).filter(Array.isArray);
		if (arrays.length === 1) return { verdicts: arrays[0] };
	}
	return raw;
}

/**
 * Type each surviving candidate. Anything the model does not call an alias is
 * rejected, and a batch that fails outright rejects its whole batch rather than
 * falling through — an unclassified candidate is a raw cosine guess, which is
 * the thing this stage exists to stop reaching the review list.
 */
async function classify(candidates: Scored[]): Promise<void> {
	for (let i = 0; i < candidates.length; i += BATCH) {
		const batch = candidates.slice(i, i + BATCH);
		const listed = batch
			.map((s, n) => `${n}. PHRASE="${s.phrase.label}"  CONCEPT="${s.best!.label}"`)
			.join('\n');
		try {
			// The TRACKED variant, deliberately: `generateChatCompletion` validates
			// against the schema itself and throws before a caller can see the body,
			// and the whole point of `coerceIndexedEnvelope` is to accept the shapes
			// the model actually returns. Same reasoning as propose-skill-relations.
			const res = await generateChatCompletionTracked(
				[
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: `Classify these ${batch.length} items:\n\n${listed}` }
				],
				{ temperature: 0, structuredOutput: { name: 'alias_verdicts', schema: VerdictSchema } }
			);
			const items = coerceIndexedEnvelope(
				envelope(JSON.parse(res.content)),
				'verdicts',
				VerdictItem
			);
			for (const { index, value: v } of items) {
				const s = batch[v.item ?? index];
				if (s) s.verdict = v.verdict;
			}
		} catch (err) {
			console.warn(`  batch ${i / BATCH} failed, rejecting it: ${(err as Error).message}`);
		}
		for (const s of batch) {
			if (s.verdict === 'alias') continue;
			s.reject = s.verdict === 'narrower' ? 'narrower' : 'not-alias';
		}
		console.log(`  typed ${Math.min(i + BATCH, candidates.length)}/${candidates.length}`);
	}
}

async function main(): Promise<void> {
	if (!isEmbeddingConfigured()) {
		console.error(
			'Refusing to run — embeddings are not configured.\n' +
				'Needs SJS_EMBEDDING_ENABLED=true and a provider key ' +
				`(SJS_EMBEDDING_PROVIDER=${config.embeddingProvider}).`
		);
		process.exit(1);
	}

	const before = await coverage();
	const phrases = await uncovered();
	console.log(
		`Coverage now: ${before.pct.toFixed(1)}% of ${before.total} skill mentions.\n` +
			`Scoring the top ${phrases.length} uncovered phrases (>= ${MIN_MENTIONS} mentions).\n`
	);
	if (phrases.length === 0) {
		console.log('Nothing uncovered above the mention floor.');
		process.exit(0);
	}

	const concepts = await queryRawDirect<{ id: number; slug: string; label: string }>(
		sql`SELECT id, slug, label FROM skill_concepts`
	);
	const conceptSlugs = new Set(concepts.map((c) => c.slug));

	// Cheap guards first, so nothing is embedded that could never be written.
	// `splitCompoundSkill` returns [] when the entry names one skill.
	const scored: Scored[] = phrases.map((phrase) => {
		if (splitCompoundSkill(phrase.label).length > 0)
			return { phrase, literal: false, reject: 'compound' as const };
		if (words(phrase.label) > MAX_WORDS)
			return { phrase, literal: false, reject: 'prose' as const };
		if (conceptSlugs.has(phrase.key))
			return { phrase, literal: false, reject: 'is-concept' as const };
		return { phrase, literal: false };
	});
	const live = scored.filter((s) => !s.reject);

	// One cache for both sides. `skill_embeddings` is keyed by normalized string
	// and concept labels are strings, so concepts need no store of their own —
	// and this reuses the shipped path's validation, which refuses to persist the
	// empty vectors a provider can return instead of throwing. Cached, so a
	// re-run over the same corpus costs nothing.
	const toEmbed = [...concepts.map((c) => c.label), ...live.map((s) => s.phrase.label)];
	const added = await backfillSkillVocabulary(toEmbed);
	console.log(
		`vocabulary: ${concepts.length} concepts, ${live.length} phrases (${added} newly embedded)\n`
	);

	const dims = config.embeddingWorkingDimensions;
	const rows = await queryRawDirect<{ skill: string; embedding: number[] }>(
		sql`SELECT skill, embedding FROM skill_embeddings WHERE skill IN (${inList([
			...new Set(toEmbed.map(normalizeSkill).filter(Boolean))
		])})`
	);
	const vec = new Map<string, number[]>();
	for (const r of rows) vec.set(r.skill, truncateVector(r.embedding as number[], dims));

	// A concept's slug and its normalized label can disagree — that is what the
	// audit calls slug drift — so key the lookup by the label we embedded.
	const conceptVecs = concepts
		.map((c) => ({ ...c, v: vec.get(normalizeSkill(c.label)) ?? vec.get(c.slug) }))
		.filter((c): c is typeof c & { v: number[] } => !!c.v);
	if (conceptVecs.length < concepts.length) {
		console.log(`note: ${concepts.length - conceptVecs.length} concepts have no vector\n`);
	}

	for (const s of live) {
		const q = vec.get(s.phrase.key);
		if (!q) {
			s.reject = 'no-vector';
			continue;
		}
		let b1: { slug: string; label: string; sim: number } | undefined;
		let b2: { label: string; sim: number } | undefined;
		for (const c of conceptVecs) {
			const sim = cosineSimilarity(q, c.v);
			if (!b1 || sim > b1.sim) {
				b2 = b1;
				b1 = { slug: c.slug, label: c.label, sim };
			} else if (!b2 || sim > b2.sim) {
				b2 = { label: c.label, sim };
			}
		}
		s.best = b1;
		s.runnerUp = b2;
		s.literal = !!b1 && normalizeSkill(s.phrase.label).includes(normalizeSkill(b1.label));
		if (!b1 || b1.sim < FLOOR) s.reject = 'below-floor';
		else if (b2 && b1.sim - b2.sim < MARGIN) s.reject = 'ambiguous';
	}

	const survivors = scored.filter((s) => !s.reject && s.best);
	if (!NO_LLM && survivors.length > 0) {
		console.log(`typing ${survivors.length} candidates the vectors shortlisted:`);
		await classify(survivors);
		console.log('');
	}

	const accepted = scored.filter((s) => !s.reject && s.best);
	const rejected = scored.filter((s) => s.reject);

	console.log(`PROPOSED (${accepted.length}) — "phrase" → concept\n`);
	console.log(
		'   n  phrase                                   → concept                 top1   top2   Δ   lit'
	);
	for (const s of accepted.sort((a, b) => b.phrase.n - a.phrase.n)) {
		const d = s.best!.sim - (s.runnerUp?.sim ?? 0);
		console.log(
			`${String(s.phrase.n).padStart(4)}  ${s.phrase.label.slice(0, 38).padEnd(40)} → ` +
				`${s.best!.label.slice(0, 22).padEnd(22)} ${s.best!.sim.toFixed(3)}  ` +
				`${(s.runnerUp?.sim ?? 0).toFixed(3)} ${d.toFixed(3)}  ${s.literal ? '✓' : '·'}`
		);
	}

	// Rejects are printed, not silently dropped: they are how FLOOR and MARGIN
	// get replaced by evidence, and a guard firing on something that should have
	// passed is invisible otherwise.
	console.log(`\nREJECTED (${rejected.length}), by guard:`);
	for (const g of Object.keys(GUARDS) as Reject[]) {
		const hits = rejected.filter((s) => s.reject === g);
		if (hits.length === 0) continue;
		console.log(`\n  ${g} — ${GUARDS[g]}  (${hits.length})`);
		for (const s of hits.sort((a, b) => b.phrase.n - a.phrase.n).slice(0, 8)) {
			const near = s.best
				? ` → ${s.best.label} ${s.best.sim.toFixed(3)} / ${(s.runnerUp?.sim ?? 0).toFixed(3)}`
				: '';
			console.log(`    ${String(s.phrase.n).padStart(4)}  ${s.phrase.label}${near}`);
		}
		if (hits.length > 8) console.log(`    … and ${hits.length - 8} more`);
	}

	const gain = accepted.reduce((a, s) => a + s.phrase.n, 0);
	const after = before.total ? ((before.covered + gain) / before.total) * 100 : 0;
	console.log(
		`\n${gain} mentions would newly resolve IF ALL ARE APPROVED: ` +
			`${before.pct.toFixed(1)}% → ${after.toFixed(1)}% (+${(after - before.pct).toFixed(1)}pp).`
	);

	if (!APPLY) {
		console.log('\nDry run. Pass --apply to write UNAPPROVED aliases.');
		process.exit(0);
	}

	let written = 0;
	for (const s of accepted) {
		const res = await db.execute(sql`
			INSERT INTO skill_aliases (concept_id, alias, source)
			SELECT c.id, ${s.phrase.key}, ${SOURCE}
			FROM skill_concepts c WHERE c.slug = ${s.best!.slug}
			ON CONFLICT (alias) DO NOTHING
		`);
		written += res.rowCount ?? 0;
	}

	console.log(`\nWrote ${written} UNAPPROVED aliases (source "${SOURCE}").`);
	console.log('Nothing influences matching until approved, one id at a time:');
	console.log('  npx tsx scripts/approve-skill-relations.ts --aliases');
	process.exit(0);
}

await main();
