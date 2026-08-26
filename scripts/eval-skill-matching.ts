/**
 * Score the skill-matching layers against a labelled set of pairs.
 *
 * The gate for planning/SKILL-ONTOLOGY.md (in sjs-ops): before adding typed
 * relations under the matcher, establish what the layers already there
 * actually achieve. A claim of improvement over an unmeasured baseline is not
 * a claim.
 *
 * ## What it measures
 *
 * A pair is `{ have, want, match }` — a skill on the profile, a skill a job
 * asks for, and whether the profile should count as having it. Two
 * configurations are scored against the same labels:
 *
 *   exact       normalizeSkill(have) === normalizeSkill(want)
 *   +embeddings expandProfileSkills([have]) contains want
 *
 * `have`/`want` is deliberately ordered, because the relation is directional
 * and that is the whole point: React implies JavaScript, JavaScript does not
 * imply React. Cosine cannot tell those apart — it returns one number for the
 * unordered pair — so every false positive on a DOWN row is a defect no
 * threshold removes.
 *
 *   cat ../planning/evidence/skill-pairs.json | \
 *     npx dotenvx run -f .env -- sh -c 'docker compose exec -T \
 *       -e SJS_LLM_API_KEY_GEMINI="$SJS_LLM_API_KEY_GEMINI" \
 *       app npx tsx scripts/eval-skill-matching.ts'
 *
 * Run from `cloud/`. Pairs arrive on stdin so a set can live outside this
 * repository, the same arrangement as eval-assistant-questions.ts.
 *
 * Embedding calls are cached in `skill_embeddings`, so a re-run over the same
 * vocabulary costs nothing.
 */
import { readFileSync } from 'node:fs';
import { normalizeSkill } from '../src/lib/skills';
import { expandProfileSkills } from '../src/lib/server/job/skill-embeddings';
import { impliesSkill } from '../src/lib/server/job/skill-ontology';
import { config } from '../src/lib/server/config';

interface Pair {
	have: string;
	want: string;
	match: boolean;
	why?: string;
}

interface Scored extends Pair {
	exact: boolean;
	expanded: boolean;
	ontology: boolean;
}

function readPairs(): Pair[] {
	if (process.stdin.isTTY) {
		console.error('No pairs on stdin. Pipe a JSON array in — see the header.');
		process.exit(1);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(0, 'utf-8'));
	} catch (err) {
		console.error(`stdin is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}
	if (!Array.isArray(parsed) || parsed.length === 0) {
		console.error('Expected a non-empty JSON array of { have, want, match, why? }.');
		process.exit(1);
	}
	for (const [i, p] of parsed.entries()) {
		if (
			!p ||
			typeof p.have !== 'string' ||
			typeof p.want !== 'string' ||
			typeof p.match !== 'boolean'
		) {
			console.error(`Pair ${i + 1} needs string \`have\`, string \`want\`, boolean \`match\`.`);
			process.exit(1);
		}
	}
	return parsed as Pair[];
}

/** Precision, recall and accuracy for one configuration. */
function score(rows: Scored[], pick: (r: Scored) => boolean) {
	const tp = rows.filter((r) => r.match && pick(r)).length;
	const fp = rows.filter((r) => !r.match && pick(r)).length;
	const fn = rows.filter((r) => r.match && !pick(r)).length;
	const tn = rows.filter((r) => !r.match && !pick(r)).length;
	const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
	const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
	const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
	return { tp, fp, fn, tn, precision, recall, f1 };
}

function pct(n: number): string {
	return `${(n * 100).toFixed(1)}%`;
}

const pairs = readPairs();

console.log(
	`\nembeddings: enabled=${config.embeddingEnabled} model=${config.embeddingModel} ` +
		`dims=${config.embeddingWorkingDimensions} threshold=${config.embeddingSkillThreshold}`
);
console.log(`pairs: ${pairs.length} (${pairs.filter((p) => p.match).length} should match)\n`);

const rows: Scored[] = [];
for (const p of pairs) {
	const wantNorm = normalizeSkill(p.want);
	const exact = normalizeSkill(p.have) === wantNorm;
	// One skill in, so the expansion is exactly "what does knowing `have` imply".
	const expandedSet = await expandProfileSkills([p.have]);
	const expanded = expandedSet.some((s) => normalizeSkill(s) === wantNorm);
	// Ordered: does knowing `have` license claiming `want`. Approved edges only.
	const ontology = await impliesSkill(p.have, p.want);
	rows.push({ ...p, exact, expanded, ontology });
}

const configs: Array<[string, (r: Scored) => boolean]> = [
	['exact', (r) => r.exact],
	['+embeddings', (r) => r.exact || r.expanded],
	['+ontology', (r) => r.exact || r.expanded || r.ontology],
	// The ontology INSTEAD of embeddings, not on top. Worth scoring separately
	// because the two can disagree, and if structure alone beats the stack then
	// the expansion layer is costing precision for recall it no longer supplies.
	['ontology only', (r) => r.exact || r.ontology]
];

console.log('config        TP  FP  FN  TN   precision   recall      F1');
console.log('─'.repeat(64));
for (const [name, pick] of configs) {
	const s = score(rows, pick);
	console.log(
		`${name.padEnd(13)} ${String(s.tp).padStart(2)}  ${String(s.fp).padStart(2)}  ` +
			`${String(s.fn).padStart(2)}  ${String(s.tn).padStart(2)}   ` +
			`${pct(s.precision).padStart(8)}   ${pct(s.recall).padStart(8)}  ${pct(s.f1).padStart(6)}`
	);
}

// The rows that decide whether an ontology is worth building: pairs the
// embedding layer gets WRONG, split by direction. A false positive here is
// one no threshold removes, because the correct pair sits at the same cosine.
for (const [name, pick] of configs) {
	const fp = rows.filter((r) => !r.match && pick(r));
	const fn = rows.filter((r) => r.match && !pick(r));
	if (name === 'exact') continue;
	console.log(`\n── ${name} ──`);
	console.log(`FALSE POSITIVES (${fp.length}):`);
	for (const r of fp) console.log(`  ${r.have} → ${r.want}${r.why ? `   [${r.why}]` : ''}`);
	console.log(`FALSE NEGATIVES (${fn.length}):`);
	for (const r of fn) console.log(`  ${r.have} → ${r.want}${r.why ? `   [${r.why}]` : ''}`);
}

process.exit(0);
