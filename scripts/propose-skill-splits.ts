/**
 * Split compound skill entries into their parts: "Vitest / Jest" → Vitest, Jest.
 *
 * ## The defect
 *
 * `normalizeSkill` flattens a whole entry to one token, so "Vitest / Jest"
 * becomes `vitestjest` and matches nothing. Measured on dev before this ran, a
 * profile listing it reached exactly one concept — "Unit Testing" — and NOT
 * Jest, which was already in the vocabulary as its own concept. "Svelte /
 * SvelteKit" reached Svelte, and "SvelteKit" existed nowhere in the vocabulary
 * at all. Compounds do not merely fail to match; they keep their parts out of
 * the graph entirely.
 *
 * The proposer had been trying to say this in the only vocabulary it had — the
 * queue held "Agile/Scrum is a kind of Scrum" at 0.97 — which is the right
 * instinct and the wrong relation. Hence `covers`.
 *
 *   docker compose exec -T -e SJS_LLM_API_KEY_GROQ=… app \
 *     npx tsx scripts/propose-skill-splits.ts [--apply]
 *
 * Without `--apply` it prints what it would write and touches nothing. Run
 * `propose-skill-relations.ts --apply` first if the vocabulary is stale: this
 * script reads `skill_concepts` and does not rebuild it.
 *
 * ## Why an LLM is in the loop at all
 *
 * Because splitting is a guess and the guesses fail in both directions. "R&D"
 * splits as cleanly as "HTML/CSS"; "CI/CD" is one idiom, not two skills; "Unit
 * / Integration Testing" needs a word restored that the writer only typed once.
 * `splitCompoundSkill` enumerates the readings — it cannot choose between them,
 * because nothing in the string says which is right.
 *
 * What narrows the LLM's job is the vocabulary: each candidate part is marked
 * with whether it is already a concept. A reading whose parts all resolve is
 * near-certainly correct, and one whose parts resolve to nothing is the case to
 * be suspicious of. That still leaves genuinely new skills to mint (SvelteKit,
 * Vitest), which is the one thing resolution cannot decide alone.
 *
 * ## Nothing here approves anything
 *
 * Same gate as every other proposer: rows land with `approved_at` null and
 * `expandUpward` does not traverse them. A wrong split is a wrong edge — global,
 * invisible, and shared by every profile. See planning/SKILL-ONTOLOGY.md.
 */
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { dbDirect as db, queryRawDirect } from '../src/lib/server/db';
import { generateChatCompletionTracked } from '../src/lib/server/llm/langchain';
import { coerceIndexedEnvelope } from '../src/lib/server/llm/structured-envelope';
import { normalizeSkill, splitCompoundSkill, type CompoundReading } from '../src/lib/skills';

const APPLY = process.argv.includes('--apply');
/** Entries per LLM call. Each carries a few readings, so keep the batch small. */
const BATCH = 8;

const SplitItem = z.object({
	item: z.number().int().optional(),
	/** False for one idiom written with a slash — "CI/CD", "R&D", "TCP/IP". */
	split: z.boolean(),
	/**
	 * The parts, spelled as they should appear in the vocabulary. Not required
	 * to come from the offered readings: the model may correct a reading's
	 * spelling ("Front development" → "Frontend development").
	 */
	parts: z.array(z.string()).optional(),
	confidence: z.number().min(0).max(1).optional()
});

/** What the model is ASKED for. What it returns is normalised by `coerceIndexedEnvelope`. */
const SplitSchema = z.object({ splits: z.array(SplitItem) });

const SYSTEM = `You decide whether one skill entry names MORE THAN ONE skill.

People write several skills in one entry to save a row: "Vitest / Jest" means
they have used both. Your job is to say when that happened, and to name the
parts.

Return split=false when the entry is ONE skill that merely contains a
separator:
  "CI/CD"         one practice, universally written this way -> false
  "R&D"           not two skills                             -> false
  "TCP/IP"        one protocol suite                         -> false
  "Node.js"       no separator at all                        -> false

Return split=true with the parts when it is genuinely several:
  "Vitest / Jest"              -> ["Vitest", "Jest"]
  "Agile/Scrum"                -> ["Agile", "Scrum"]
  "HTML/CSS"                   -> ["HTML", "CSS"]

Watch for a word the writer typed once and meant twice. "Unit / Integration
Testing" is NOT ["Unit", "Integration Testing"] — "Unit" names nothing. It is
["Unit Testing", "Integration Testing"]. Each part must stand on its own as a
skill someone could list by itself.

You are shown candidate readings and told which parts are ALREADY in the
vocabulary. A reading whose parts are all known is very likely the right one.
A part that is unknown is not wrong — genuinely new skills exist, and
"SvelteKit" being absent is a gap to fill, not a reason to reject — but an
entry where NO part is known and none is a recognisable skill name should be
split=false.

Do not invent parts the entry does not contain. Do not expand abbreviations.

confidence: 0-1, how sure you are.

Return ONE object with a "splits" ARRAY, in the same order as the input, each
carrying the index it answers:

{"splits":[{"item":0,"split":true,"parts":["Vitest","Jest"],"confidence":0.95},
           {"item":1,"split":false,"confidence":0.9}]}

Do NOT return an object keyed by index. "splits" must be a JSON array.`;

interface Candidate {
	id: number;
	slug: string;
	label: string;
	readings: CompoundReading[];
}

/** Render one entry for the prompt, marking which candidate parts already exist. */
function describe(c: Candidate, known: Set<string>, n: number): string {
	const lines = c.readings.map((r) => {
		const parts = r.parts
			.map((p) => `"${p}"${known.has(normalizeSkill(p)) ? ' [known]' : ''}`)
			.join(', ');
		return `     ${r.kind}: ${parts}`;
	});
	return `${n}. "${c.label}"\n${lines.join('\n')}`;
}

async function main() {
	const concepts = await queryRawDirect<{ id: number; slug: string; label: string }>(sql`
		SELECT id, slug, label FROM skill_concepts ORDER BY label
	`);
	const known = new Set(concepts.map((c) => c.slug));
	const idBySlug = new Map(concepts.map((c) => [c.slug, c.id]));

	const candidates: Candidate[] = [];
	for (const c of concepts) {
		const readings = splitCompoundSkill(c.label);
		if (readings.length > 0) candidates.push({ ...c, readings });
	}
	console.log(
		`${concepts.length} concepts, ${candidates.length} look compound:\n` +
			candidates.map((c) => `  ${c.label}`).join('\n') +
			'\n'
	);
	if (candidates.length === 0) return;

	const decisions: { candidate: Candidate; parts: string[]; confidence: number }[] = [];

	for (let i = 0; i < candidates.length; i += BATCH) {
		const batch = candidates.slice(i, i + BATCH);
		const listed = batch.map((c, n) => describe(c, known, n)).join('\n');
		try {
			// The TRACKED variant, deliberately: `generateChatCompletion` validates
			// against the schema itself and throws before a caller can see the body,
			// and the whole point of `coerceIndexedEnvelope` is to accept a shape the
			// model actually returns.
			const res = await generateChatCompletionTracked(
				[
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: `Classify these ${batch.length} entries:\n\n${listed}` }
				],
				{ temperature: 0, structuredOutput: { name: 'skill_splits', schema: SplitSchema } }
			);
			for (const { index, value: v } of coerceIndexedEnvelope(
				JSON.parse(res.content),
				'splits',
				SplitItem
			)) {
				const candidate = batch[v.item ?? index];
				if (!candidate || !v.split) continue;
				// A part identical to the whole is the model declining to split while
				// saying it did, and a part that normalizes away is not a skill.
				const parts = (v.parts ?? [])
					.map((p) => p.trim())
					.filter((p) => normalizeSkill(p) && normalizeSkill(p) !== candidate.slug);
				if (parts.length < 2) continue;
				decisions.push({ candidate, parts, confidence: v.confidence ?? 0.5 });
			}
			process.stdout.write(`  batch ${i / BATCH + 1}: done\n`);
		} catch (err) {
			console.warn(`  batch ${i / BATCH + 1} FAILED: ${err instanceof Error ? err.message : err}`);
		}
	}

	console.log(`\n${decisions.length} of ${candidates.length} entries split:\n`);
	for (const d of decisions) {
		const marked = d.parts
			.map((p) => `${p}${known.has(normalizeSkill(p)) ? '' : ' (new concept)'}`)
			.join(', ');
		console.log(`  "${d.candidate.label}" covers ${marked}  (${d.confidence.toFixed(2)})`);
	}
	const kept = candidates.filter((c) => !decisions.some((d) => d.candidate.id === c.id));
	if (kept.length > 0) {
		console.log(`\nleft whole: ${kept.map((c) => `"${c.label}"`).join(', ')}`);
	}

	if (!APPLY) {
		console.log('\nDry run. Pass --apply to mint concepts and write UNAPPROVED covers edges.');
		return;
	}

	let minted = 0;
	let written = 0;
	for (const d of decisions) {
		for (const part of d.parts) {
			const slug = normalizeSkill(part);
			// Minting a part the reviewer later rejects leaves a concept with no
			// edges, which reaches only itself — harmless, and it makes the part
			// matchable by its own name in the meantime.
			if (!idBySlug.has(slug)) {
				await db.execute(
					sql`INSERT INTO skill_concepts (slug, label) VALUES (${slug}, ${part}) ON CONFLICT (slug) DO NOTHING`
				);
				const [row] = await queryRawDirect<{ id: number }>(
					sql`SELECT id FROM skill_concepts WHERE slug = ${slug}`
				);
				if (row) idBySlug.set(slug, row.id);
				minted++;
			}
			const toId = idBySlug.get(slug);
			if (!toId) continue;
			await db.execute(sql`
				INSERT INTO skill_relations (from_id, to_id, relation, confidence, source)
				VALUES (${d.candidate.id}, ${toId}, 'covers', ${d.confidence}, 'llm')
				ON CONFLICT DO NOTHING
			`);
			written++;
		}
	}
	console.log(`\nminted ${minted} concept(s), wrote ${written} unapproved covers edge(s).`);
	console.log('Review them at /admin/skill-ontology — nothing matches until you do.');
}

await main();
process.exit(0);
