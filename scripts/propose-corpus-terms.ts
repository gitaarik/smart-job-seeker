/**
 * Decide what to do with every corpus phrase the graph cannot resolve: another
 * name for a skill we have, a skill we are missing, or nothing at all.
 *
 *   docker compose exec -T -e SJS_LLM_API_KEY_GROQ="$SJS_LLM_API_KEY_GROQ" \
 *     app npx tsx scripts/propose-corpus-terms.ts [--limit N] [--apply]
 *
 * Without `--apply` it prints what it would write and touches nothing. No
 * embeddings, so no `SJS_EMBEDDING_ENABLED` and no provider key for them.
 *
 * ## Why this sits next to `propose-corpus-aliases.ts` rather than replacing it
 *
 * That script asks a version of the same question in two stages: cosine picks
 * ONE concept and a structured call confirms or rejects it. The price of that
 * shape is that the model never sees an alternative. It can say "no", never
 * "no, it is this other one" — and two constants decide what it is shown at
 * all, `FLOOR` 0.65 and `MARGIN` 0.05, both of which that file's own docstring
 * calls starting points rather than measurements. Its worked example is the
 * tell: "experience with MSSQL" picks SQL with PostgreSQL 0.012 behind and is
 * dropped as a coin flip, which is precisely the case a language model settles
 * in one line.
 *
 * The vocabulary is 317 labels, 3,630 characters, roughly a thousand tokens. It
 * FITS IN THE PROMPT. So retrieval is optional here, and paying for it in
 * recall is a bad trade: this script hands the model the whole list, with no
 * shortlist, no floor and no margin.
 *
 * **That is a scale argument, not a principle.** Retrieval earns its place back
 * the moment the candidate set stops fitting in a prompt. An external taxonomy
 * (ESCO, O*NET, Lightcast) is tens of thousands of concepts and this design
 * dies there. Measure the vocabulary before assuming the trade still holds; the
 * dry run prints its token-ish size for exactly that reason.
 *
 * ## Three answers, because two was the wrong number
 *
 * `propose-corpus-aliases.ts` can only propose aliases, so a phrase naming a
 * skill the graph does not have comes back in its `narrower` reject bucket as a
 * reading list, and `propose-corpus-gaps.ts` is a human reading that list and
 * hand-writing the concept. The split between "we have this under another name"
 * and "we are missing this" is the whole judgement, and it was the one part
 * with no automation at all. So it is a verdict here: `alias`, `concept` or
 * `skip`.
 *
 * The bias is written into the prompt and repeated in the guards: **when torn,
 * mint a concept, not an alias.** Getting it wrong toward `alias` is expensive
 * and invisible, because an alias makes one concept answer for another
 * everywhere, in both directions, with no traversal left to inspect. Getting it
 * wrong toward `concept` is cheap: an unconnected concept matches its own name
 * and nothing else, which is what the isolated concepts already in the graph
 * do, and someone can merge it later.
 *
 * ## Nothing here approves anything
 *
 * Aliases and relations land with `approved_at` null and `expandUpward` does
 * not traverse them. Concepts are written directly, for the reason
 * `propose-corpus-gaps.ts` gives: a concept with no approved edge is inert, it
 * answers its own name and nothing else, so there is nothing for an approval to
 * protect. That asymmetry is deliberate, and it means a minted concept starts
 * resolving its own phrase immediately while its parent edge waits.
 *
 *   npx tsx scripts/approve-skill-relations.ts --source corpus-llm  # the edges
 *   npx tsx scripts/approve-skill-relations.ts --aliases            # then --approve <id…>
 */
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { normalizeSkill, splitCompoundSkill } from '../src/lib/skills';
import { generateChatCompletionTracked } from '../src/lib/server/llm/langchain';
import { coerceIndexedEnvelope } from '../src/lib/server/llm/structured-envelope';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
/** Write concepts the model could find no parent for. Off: they are a report. */
const ALLOW_UNPARENTED = args.includes('--allow-unparented');
const SOURCE = 'corpus-llm';

function numArg(flag: string, fallback: number): number {
	const i = args.indexOf(flag);
	const v = i > -1 ? Number(args[i + 1]) : NaN;
	return Number.isFinite(v) ? v : fallback;
}

/** How many uncovered phrases to classify, most-asked-for first. */
const LIMIT = numArg('--limit', 200);
/** Below this many mentions a phrase is not worth a reviewer's attention. */
const MIN_MENTIONS = numArg('--min-mentions', 2);

/**
 * Past this many words it is prose, not a name for a concept.
 *
 * Same constant and same reasoning as `propose-corpus-aliases.ts`: the corpus is
 * overwhelmingly short because `skills_required` is LLM-extracted rather than
 * scraped, and what is left in the tail is genuinely sentences. Kept as a cheap
 * pre-filter rather than left to the model, because a sentence costs a slot in
 * a batch and the answer is knowable without a call.
 */
const MAX_WORDS = numArg('--max-words', 5);

/**
 * Phrases per call.
 *
 * The vocabulary is paid once per CALL, not per phrase, so a bigger batch
 * amortises it — at 12 it is roughly 80 tokens of overhead per phrase, at 50 it
 * is 20. It stays small anyway because a batch that fails to parse is rejected
 * whole (see `classify`), and 12 phrases is a cheap thing to lose and re-run.
 * Raise it when a run is large and the failure rate is observed to be zero.
 */
const BATCH = numArg('--batch', 12);

/**
 * What the model returns per phrase.
 *
 * `concept` and `parent` name entries in the vocabulary by LABEL, because that
 * is what the model was shown; every one is resolved back to a real row before
 * anything is written, and an unrecognised name is a rejection rather than a
 * best guess. `label` lets the model re-case the phrase it is minting ("data
 * engineering" → "Data Engineering") and is guarded so it can only re-spell,
 * never rename.
 *
 * Lenient in the two ways this codebase has already measured the configured
 * models to be: a bare string instead of an object, and an envelope whose key
 * the model renamed. Both are absorbed rather than argued with. A schema is a
 * contract the model did not sign; see the notes in
 * `propose-corpus-aliases.ts` and planning/SKILL-ONTOLOGY.md.
 */
/**
 * The envelope shapes observed on real runs, absorbed rather than argued with.
 *
 * `propose-corpus-aliases.ts` carries the same function and records what it
 * cost to learn: a batch that fails to parse is rejected wholesale, so a
 * renamed property key does not read as "no answer", it reads as "the answer
 * was no" — which is the worst shape of bug available here. Any single
 * array-valued property, and a bare top-level array, are unwrapped onto the
 * expected key; the index-keyed object form is left for the shared helper.
 *
 * It runs as the schema's own preprocess, not just at the call site, because
 * that is where it has to be: `generateChatCompletionTracked` validates against
 * this schema and throws before any caller sees the body. The first real run of
 * this script proved it — the model answered with a bare top-level array, the
 * schema said "expected object", and twelve phrases were rejected wholesale
 * having been classified perfectly.
 */
function envelope(raw: unknown): unknown {
	if (Array.isArray(raw)) return { verdicts: raw };
	if (raw && typeof raw === 'object') {
		const arrays = Object.values(raw as Record<string, unknown>).filter(Array.isArray);
		if (arrays.length === 1) return { verdicts: arrays[0] };
	}
	return raw;
}

const Verdict = z.enum(['alias', 'concept', 'skip']);

const VerdictItem = z.preprocess(
	(v) => (typeof v === 'string' ? { verdict: v } : v),
	z.object({
		item: z.number().int().optional(),
		/** The phrase echoed back. Preferred over position when present. */
		phrase: z.string().optional(),
		verdict: Verdict,
		/** For `alias`: the vocabulary entry this phrase names. */
		concept: z.string().optional(),
		/** For `concept`: the vocabulary entry it sits under. */
		parent: z.string().optional(),
		/** For `concept`: a nicer spelling of the phrase itself. */
		label: z.string().optional(),
		confidence: z.number().min(0).max(1).optional()
	})
);

const VerdictSchema = z.preprocess(
	envelope,
	z.looseObject({ verdicts: z.array(VerdictItem).optional() })
);

const SYSTEM = `You are curating a vocabulary of skills used to match job seekers to job
postings. Each phrase you are given was written by an employer in a real posting
and matches nothing in the vocabulary. Decide what it is.

Every skill you name in an answer must be copied EXACTLY from the vocabulary
list below. Never invent one.

Answer one of three verdicts per phrase.

- "alias": the phrase is another way of writing a skill that is already in the
  list. Put that skill in "concept".
  Spelling variants ("Postgres" / "PostgreSQL"), an acronym or its expansion
  ("AI (Artificial Intelligence)" / "AI"), a qualifier wrapped around it
  ("Mastery of SQL" / "SQL"), a plural ("NoSQL databases" / "NoSQL").
  The test: could you swap one for the other in a posting and change nothing
  about who qualifies? If not, it is not an alias.

- "concept": the phrase is a real skill of its own that is NOT in the list and
  should be added. Put the list entry it belongs under in "parent" — the more
  general skill someone would say this is a kind of, or that this one cannot be
  used without. If nothing in the list is a reasonable parent, leave "parent"
  out rather than reaching for a loose one.
  "PySpark" is not another word for "Apache Spark", it is its own skill.
  "Deep Learning" is a kind of "Machine Learning", not another word for it.
  You may also give "label", a better-cased spelling of the SAME phrase
  ("data engineering" → "Data Engineering"). Do not rename it.

- "skip": NOT A SKILL AT ALL. A fragment ("Ops", "Edu"), a job title
  ("Engineer"), a requirement ("5 years experience"), prose, or something too
  vague to be worth a vocabulary entry.
  "Out of scope" is not a reason to skip. If the phrase is a real skill that
  nothing in the list could host — a whole field we do not cover — answer
  "concept" and leave "parent" out. Whether to cover that field is not your
  decision, and a skip hides it.

Return {"verdicts": [...]}, one entry per phrase, in the order given. Echo the
phrase you are answering about in "phrase", then give "verdict" and whatever
that verdict needs.

When you are torn between "alias" and "concept", answer "concept". A wrong alias
makes one skill answer for another for every applicant, in both directions,
permanently. A redundant new skill is harmless: it matches its own name until
someone merges it.`;

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
 * the same arrangement the sibling proposers use, and for the same reason.
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
	| 'compound' // names several concepts; one entry cannot be either verdict
	| 'prose' // longer than MAX_WORDS
	| 'is-concept' // the key is already a concept slug
	| 'batch-failed' // the call or the parse died and took its batch with it
	| 'no-verdict' // the model returned nothing for this item
	| 'skip' // the model says it is not a skill
	| 'unknown-concept' // named something that is not in the vocabulary
	| 'no-concept' // said alias, named nothing
	| 'slug-taken' // said concept, but that slug exists — it is an alias question
	| 'self-parent' // said concept, parented to itself
	| 'label-drift' // proposed a label that is a different phrase, not a respelling
	| 'unparented'; // said concept, no parent in the vocabulary fits

const GUARDS: Record<Reject, string> = {
	compound: 'names several skills — wants a split, not one entry',
	prose: `longer than ${MAX_WORDS} words — a sentence, not a name`,
	'is-concept': 'already a concept slug',
	'batch-failed': 'its batch failed to parse and was rejected whole',
	'no-verdict': 'no verdict came back for it',
	skip: 'not a skill',
	'unknown-concept': 'named a skill that is not in the vocabulary',
	'no-concept': 'called it an alias of nothing',
	'slug-taken': 'that concept already exists — this is an alias question',
	'self-parent': 'parented to itself',
	'label-drift': 'proposed a label that renames the phrase rather than respelling it',
	unparented: 'a real skill, but nothing in the vocabulary can host it'
};

interface Concept {
	id: number;
	slug: string;
	label: string;
}

interface Judged {
	phrase: Phrase;
	verdict?: 'alias' | 'concept' | 'skip';
	/** For `alias`, the concept it names. For `concept`, its parent. */
	target?: Concept;
	/** For `concept`, the spelling to mint it under. */
	mintAs?: string;
	confidence?: number;
	reject?: Reject;
}

function words(s: string): number {
	return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Classify one batch against the whole vocabulary.
 *
 * A failed call or an unparseable body rejects its batch rather than falling
 * through: an unclassified phrase is not a "skip", and writing nothing is the
 * only safe reading of "we do not know". The phrases are printed so a re-run
 * can pick them up.
 */
async function classify(batch: Judged[], vocabulary: string, byName: Map<string, Concept>) {
	const listed = batch.map((j, n) => `${n}. "${j.phrase.label}"`).join('\n');
	// Position is the fallback, not the contract: one dropped answer shifts every
	// verdict after it onto the wrong phrase, and nothing in the output would say
	// so. The echoed phrase is asked for in the prompt precisely to avoid that.
	const byPhrase = new Map(batch.map((j) => [normalizeSkill(j.phrase.label), j]));
	let items: { index: number; value: z.infer<typeof VerdictItem> }[];
	try {
		const res = await generateChatCompletionTracked(
			[
				{
					role: 'system',
					content: `${SYSTEM}\n\nVOCABULARY (${byName.size} skills):\n${vocabulary}`
				},
				{ role: 'user', content: `Classify these ${batch.length} phrases:\n\n${listed}` }
			],
			{ temperature: 0, structuredOutput: { name: 'term_verdicts', schema: VerdictSchema } }
		);
		items = coerceIndexedEnvelope(envelope(JSON.parse(res.content)), 'verdicts', VerdictItem);
	} catch (err) {
		console.warn(`  batch rejected whole: ${(err as Error).message}`);
		for (const j of batch) j.reject = 'batch-failed';
		return;
	}

	for (const { index, value: v } of items) {
		const j =
			(v.phrase ? byPhrase.get(normalizeSkill(v.phrase)) : undefined) ?? batch[v.item ?? index];
		if (!j) continue;
		j.verdict = v.verdict;
		j.confidence = v.confidence;

		if (v.verdict === 'skip') {
			j.reject = 'skip';
			continue;
		}

		const named = v.verdict === 'alias' ? v.concept : v.parent;
		if (v.verdict === 'alias' && !named) {
			j.reject = 'no-concept';
			continue;
		}
		if (named) {
			const hit = byName.get(normalizeSkill(named));
			if (!hit) {
				j.reject = 'unknown-concept';
				continue;
			}
			j.target = hit;
		}

		if (v.verdict === 'concept') {
			// A minted label may re-spell the phrase, never rename it — otherwise
			// the row stops resolving the string it was minted to resolve.
			const mintAs = v.label?.trim() || j.phrase.label;
			if (normalizeSkill(mintAs) !== j.phrase.key) {
				j.reject = 'label-drift';
				continue;
			}
			j.mintAs = mintAs;
			if (j.target && j.target.slug === j.phrase.key) {
				j.reject = 'self-parent';
				continue;
			}
			if (!j.target) j.reject = 'unparented';
		}
	}

	for (const j of batch) if (!j.verdict && !j.reject) j.reject = 'no-verdict';
}

async function main(): Promise<void> {
	const before = await coverage();
	const phrases = await uncovered();
	console.log(
		`Coverage now: ${before.pct.toFixed(1)}% of ${before.total} skill mentions.\n` +
			`Classifying the top ${phrases.length} uncovered phrases (>= ${MIN_MENTIONS} mentions).\n`
	);
	if (phrases.length === 0) {
		console.log('Nothing uncovered above the mention floor.');
		process.exit(0);
	}

	const concepts = await queryRawDirect<Concept>(
		sql`SELECT id, slug, label FROM skill_concepts ORDER BY label`
	);
	const byName = new Map<string, Concept>();
	for (const c of concepts) {
		byName.set(normalizeSkill(c.label), c);
		byName.set(c.slug, c);
	}
	const vocabulary = concepts.map((c) => c.label).join('\n');

	// The number that decides whether this design is still the right one. When
	// the vocabulary stops fitting in a prompt, go back to a retrieval stage.
	console.log(
		`vocabulary: ${concepts.length} concepts, ${vocabulary.length} chars ` +
			`(~${Math.round(vocabulary.length / 4)} tokens) sent with every call.\n`
	);

	// Cheap guards first, so nothing reaches a batch that could never be written.
	// `splitCompoundSkill` returns [] when the entry names one skill.
	const judged: Judged[] = phrases.map((phrase) => {
		if (splitCompoundSkill(phrase.label).length > 0) return { phrase, reject: 'compound' as const };
		if (words(phrase.label) > MAX_WORDS) return { phrase, reject: 'prose' as const };
		if (byName.has(phrase.key)) return { phrase, reject: 'is-concept' as const };
		return { phrase };
	});

	const live = judged.filter((j) => !j.reject);
	for (let i = 0; i < live.length; i += BATCH) {
		await classify(live.slice(i, i + BATCH), vocabulary, byName);
		console.log(`  classified ${Math.min(i + BATCH, live.length)}/${live.length}`);
	}

	// A concept whose slug already exists is an alias question wearing the wrong
	// hat, and the model cannot see the slugs to know it. Checked here rather
	// than in the prompt, because a guard is cheaper than an instruction.
	const slugs = new Set(concepts.map((c) => c.slug));
	for (const j of judged) {
		if (j.verdict === 'concept' && !j.reject && slugs.has(j.phrase.key)) j.reject = 'slug-taken';
	}

	const aliases = judged.filter((j) => j.verdict === 'alias' && !j.reject);
	const mints = judged.filter((j) => j.verdict === 'concept' && !j.reject);
	const held = judged.filter((j) => j.reject === 'unparented');
	const writeMints = ALLOW_UNPARENTED ? [...mints, ...held] : mints;

	const row = (j: Judged) => `${String(j.phrase.n).padStart(4)}  ${j.phrase.label.slice(0, 42)}`;

	console.log(`\nAliases (${aliases.length}) — the concept exists under another name:`);
	for (const j of aliases) console.log(`  ${row(j)} → ${j.target!.label}`);

	console.log(`\nConcepts (${mints.length}) — new, each with one broader edge:`);
	for (const j of mints) console.log(`  ${row(j)} —broader→ ${j.target!.label}`);

	if (held.length > 0) {
		console.log(
			`\nHeld back (${held.length}) — real skills with no host in the vocabulary.\n` +
				'These are a SCOPE question, not a classification one: nothing here fits\n' +
				'under anything we have, which usually means a whole area is missing.\n' +
				'Pass --allow-unparented to write them unconnected, or add a domain first.'
		);
		for (const j of held) console.log(`  ${row(j)}`);
	}

	// Listed, not just counted. A `skip` on a phrase 60 postings asked for is
	// either the model being right about a fragment or the vocabulary quietly
	// declining a whole field, and those look identical in a total.
	const skipped = judged.filter((j) => j.reject === 'skip');
	if (skipped.length > 0) {
		console.log(`\nSkipped (${skipped.length}) — judged not to be skills:`);
		for (const j of skipped) console.log(`  ${row(j)}`);
	}

	const counts = new Map<Reject, number>();
	for (const j of judged) if (j.reject) counts.set(j.reject, (counts.get(j.reject) ?? 0) + 1);
	console.log('\nNot written:');
	for (const [reject, n] of [...counts].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${String(n).padStart(4)}  ${reject.padEnd(16)} ${GUARDS[reject]}`);
	}

	// Split on purpose: a minted concept resolves its own phrase the moment it is
	// written, because a slug needs no approval. An alias does not resolve until
	// someone promotes it. Reporting one number would overstate the immediate
	// gain and understate what is waiting in the review list.
	const now = writeMints.reduce((a, j) => a + j.phrase.n, 0);
	const later = aliases.reduce((a, j) => a + j.phrase.n, 0);
	const pct = (mentions: number) =>
		before.total ? ((before.covered + mentions) / before.total) * 100 : 0;
	console.log(
		`\n${now} mentions resolve as soon as the concepts are written: ` +
			`${before.pct.toFixed(1)}% → ${pct(now).toFixed(1)}%.\n` +
			`${later} more once the aliases are approved: → ${pct(now + later).toFixed(1)}% ` +
			`(+${(pct(now + later) - before.pct).toFixed(1)}pp in total).`
	);

	if (!APPLY) {
		console.log('\nDry run. Pass --apply to write concepts and UNAPPROVED relations/aliases.');
		process.exit(0);
	}

	let minted = 0;
	for (const j of writeMints) {
		const res = await db.execute(sql`
			INSERT INTO skill_concepts (slug, label) VALUES (${j.phrase.key}, ${j.mintAs})
			ON CONFLICT (slug) DO NOTHING
		`);
		minted += res.rowCount ?? 0;
	}

	let edges = 0;
	for (const j of writeMints) {
		if (!j.target) continue;
		const res = await db.execute(sql`
			INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
			SELECT f.id, ${j.target.id}, 'broader', ${j.confidence ?? 0.8}, ${SOURCE}
			FROM skill_concepts f WHERE f.slug = ${j.phrase.key}
			ON CONFLICT DO NOTHING
		`);
		edges += res.rowCount ?? 0;
	}

	let aliased = 0;
	for (const j of aliases) {
		const res = await db.execute(sql`
			INSERT INTO skill_aliases (concept_id, alias, source)
			VALUES (${j.target!.id}, ${j.phrase.key}, ${SOURCE})
			ON CONFLICT (alias) DO NOTHING
		`);
		aliased += res.rowCount ?? 0;
	}

	console.log(
		`\nWrote ${minted} concepts, ${edges} UNAPPROVED relations, ` +
			`${aliased} UNAPPROVED aliases (source "${SOURCE}").`
	);
	console.log('Nothing influences matching until approved:');
	console.log(`  npx tsx scripts/approve-skill-relations.ts --source ${SOURCE}`);
	console.log('  npx tsx scripts/approve-skill-relations.ts --aliases   # then --approve <id…>');
	process.exit(0);
}

await main();
