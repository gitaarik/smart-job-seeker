/**
 * Propose, for every skill in the graph, the career level from which employers
 * take it for granted in the people whose work it belongs to: the level at which
 * a resume no longer needs a line of evidence for it.
 *
 *   docker compose exec -T worker npx dotenvx run --quiet -f .env -- \
 *     npx tsx oss/scripts/propose-assumed-levels.ts [--limit N] [--out proposals.json]
 *
 * Writes JSON and touches nothing in the database: the proposals go on a review
 * page first, and the column they will be applied to does not exist yet.
 *
 * ## Why
 *
 * Application 92 required "Version Control". The tailoring keeps the last
 * printed line naming each required skill, and the only one left was LitState,
 * whose summary says "open-sourced on GitHub" (GitHub requires Git, Git is
 * version control), so it cut the Smart Job Seeker project to keep it. For a
 * senior developer, Git needs no evidence at all.
 *
 * The postings cannot say which skills are like that. Git is asked for in 6% of
 * the senior postings on dev, because employers leave out what they assume, so
 * "rarely asked" covers both the obvious and the niche. Asked across the most
 * kinds of role is Python, which says what the searches looked for. It is
 * general knowledge, which a model has, and it changes slowly, so it is asked
 * once per skill and reviewed by a person.
 *
 * ## The answer
 *
 * - `junior`: anyone working in the field has it from the start.
 * - `medior`: anyone with a few years in the field has it.
 * - `senior`: expected of everyone senior in the field.
 * - `never`: a resume should show it whenever a job asks for it.
 *
 * `never` is what the tailoring does today for every skill, so a wrong `never`
 * costs nothing and a wrong level drops evidence from resumes. The prompt says
 * so, and asks for `never` when unsure, and when a skill is assumed in one field
 * but central in another.
 *
 * Runs on the writing model (Gemini 2.5 Pro where configured): this is a
 * judgement from general knowledge, the kind the extraction model got wrong on
 * application 92 ("GitHub presence demonstrates version-control experience").
 */
import { writeFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { queryRawDirect } from '../src/lib/server/db';
import { config } from '../src/lib/server/config';
import { normalizeSkill } from '../src/lib/skills';
import { generateChatCompletionTracked, llmCache } from '../src/lib/server/llm';

const args = process.argv.slice(2);
const option = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(option('limit') ?? 0);
const OUT = option('out');
const BATCH = 40;

const LEVELS = ['junior', 'medior', 'senior', 'never'] as const;

interface Concept {
	id: number;
	slug: string;
	label: string;
	/** Labels of what it sits under, by an approved matching relation. */
	parents: string[];
	/** The top of the graph above it: the field it belongs to. */
	fields: string | null;
	aliases: string[];
	/** Postings on this database that ask for it, by name or approved alias. */
	postings: number;
}

const SYSTEM = `You judge skills in a skills graph that is used to tailor resumes. For each skill, say from which career level employers take it for granted in the people whose work it belongs to, so that a resume needs no line of evidence for it.

This is not how important the skill is. Python is central to a Python developer's work and still needs evidence, because how well people know it varies and a job that asks for it wants to see it. Git is just as present in a developer's day and needs none: every working developer uses it, and a line proving it tells a reader nothing.

Answer one level per skill:
- "junior": anyone working in the field has it from the start. Git for developers; Microsoft Word for office work.
- "medior": anyone with a few years in the field has it. Unit testing or REST APIs for developers.
- "senior": expected of everyone senior in the field. Code review for developers.
- "never": a resume should show it whenever a job asks for it. Languages, frameworks, platforms and methods whose depth varies between people (Python, SQL, React, Kubernetes, AWS, RAG); leadership and people skills (mentoring, leading a team); domain knowledge; broad areas of work (back-end development, data analysis).

Rules:
- Judge for the field the skill belongs to, given after it. If it is taken for granted in one field and central in another (SQL for back-end developers and for data analysts), answer "never".
- When unsure, answer "never". That is how every skill is treated today, so a wrong "never" costs nothing, while a wrong level takes evidence off people's resumes.
- "field": who takes it for granted, in a few words ("software developers").
- "reason": one short sentence a reviewer can check.

Return a JSON object with one key, "levels": an array with one entry per skill, in the order given, each with exactly four string keys: "skill" (the name exactly as listed), "level", "field" and "reason".`;

const Item = z.object({
	skill: z.string(),
	level: z.enum(LEVELS),
	field: z.string(),
	reason: z.string()
});
const Answer = z.object({ levels: z.array(Item) });

async function loadConcepts(): Promise<Concept[]> {
	const rows = await queryRawDirect<{
		id: number;
		slug: string;
		label: string;
		parents: string[] | null;
		fields: string | null;
		aliases: string[] | null;
		postings: number;
	}>(sql`
		WITH RECURSIVE up(start, id, d) AS (
			SELECT id, id, 0 FROM skill_concepts
			UNION
			SELECT up.start, r.to_id, up.d + 1 FROM up
			JOIN skill_relations r ON r.from_id = up.id
			WHERE r.approved_at IS NOT NULL AND r.relation IN ('broader', 'requires', 'covers') AND up.d < 6
		),
		roots AS (
			SELECT up.start, string_agg(DISTINCT k.label, ', ') AS fields
			FROM up JOIN skill_concepts k ON k.id = up.id
			WHERE up.d > 0 AND NOT EXISTS (
				SELECT 1 FROM skill_relations r
				WHERE r.from_id = up.id AND r.approved_at IS NOT NULL AND r.relation = 'broader'
			)
			GROUP BY up.start
		),
		mentions AS (
			SELECT j.id AS job, regexp_replace(lower(trim(s)), '[^a-z0-9+#]', '', 'g') AS key
			FROM jobs j, LATERAL json_array_elements_text(j.skills_required) s
			WHERE json_typeof(j.skills_required) = 'array'
			UNION
			SELECT j.id, regexp_replace(lower(trim(s)), '[^a-z0-9+#]', '', 'g')
			FROM jobs j, LATERAL json_array_elements_text(j.skills_preferred) s
			WHERE json_typeof(j.skills_preferred) = 'array'
		),
		asked AS (
			SELECT coalesce(c.id, a.concept_id) AS concept_id, count(DISTINCT m.job)::int AS postings
			FROM mentions m
			LEFT JOIN skill_concepts c ON c.slug = m.key
			LEFT JOIN skill_aliases a ON a.alias = m.key AND a.approved_at IS NOT NULL
			WHERE coalesce(c.id, a.concept_id) IS NOT NULL
			GROUP BY 1
		)
		SELECT c.id, c.slug, c.label,
			(SELECT array_agg(t.label ORDER BY t.label) FROM skill_relations r
			 JOIN skill_concepts t ON t.id = r.to_id
			 WHERE r.from_id = c.id AND r.approved_at IS NOT NULL
			   AND r.relation IN ('broader', 'requires', 'covers')) AS parents,
			roots.fields,
			(SELECT array_agg(a.alias ORDER BY a.alias) FROM skill_aliases a
			 WHERE a.concept_id = c.id AND a.approved_at IS NOT NULL) AS aliases,
			coalesce(asked.postings, 0) AS postings
		FROM skill_concepts c
		LEFT JOIN roots ON roots.start = c.id
		LEFT JOIN asked ON asked.concept_id = c.id
		ORDER BY coalesce(asked.postings, 0) DESC, c.label
	`);
	return rows.map((r) => ({
		...r,
		parents: r.parents ?? [],
		aliases: r.aliases ?? [],
		postings: Number(r.postings)
	}));
}

/** One line per skill: its name, what it sits under and its field, so the model judges the right sense. */
function describe(c: Concept): string {
	const under = c.parents.length ? `under ${c.parents.join(', ')}` : 'top of the graph';
	const field = c.fields ? `; field: ${c.fields}` : '';
	return `${c.label} (${under}${field})`;
}

interface Proposal {
	slug: string;
	label: string;
	level: (typeof LEVELS)[number] | null;
	field: string | null;
	reason: string | null;
}

async function judge(batch: Concept[]): Promise<Proposal[]> {
	const listed = batch.map((c, n) => `${n + 1}. ${describe(c)}`).join('\n');
	const bySlug = new Map(batch.map((c) => [c.slug, c]));
	const out = new Map<string, Proposal>();
	try {
		const res = await generateChatCompletionTracked(
			[
				{ role: 'system', content: SYSTEM },
				{ role: 'user', content: `Judge these ${batch.length} skills:\n\n${listed}` }
			],
			{
				provider: config.llmWritingProvider,
				model: config.llmWritingModel,
				temperature: 0,
				// Gemini 2.5 spends its thinking out of the same budget.
				maxTokens: 32000,
				structuredOutput: { name: 'assumed_levels', schema: Answer }
			}
		);
		const answer = Answer.parse(JSON.parse(res.content));
		answer.levels.forEach((item, n) => {
			// By the name echoed back; position only when the name does not match.
			const concept = bySlug.get(normalizeSkill(item.skill)) ?? batch[n];
			if (!concept || out.has(concept.slug)) return;
			out.set(concept.slug, {
				slug: concept.slug,
				label: concept.label,
				level: item.level,
				field: item.field,
				reason: item.reason
			});
		});
	} catch (err) {
		console.warn(`  batch failed: ${(err as Error).message}`);
	}
	// A skill the answer left out has no proposal, which the page shows as such.
	return batch.map(
		(c) =>
			out.get(c.slug) ?? { slug: c.slug, label: c.label, level: null, field: null, reason: null }
	);
}

async function main(): Promise<void> {
	// Every batch is a real call; a cached answer would be a copy of an old prompt's.
	llmCache.disable();
	const all = await loadConcepts();
	const concepts = LIMIT > 0 ? all.slice(0, LIMIT) : all;
	console.log(
		`${concepts.length} skills, ${Math.ceil(concepts.length / BATCH)} calls on ` +
			`${config.llmWritingProvider} / ${config.llmWritingModel}`
	);

	const proposals: Proposal[] = [];
	for (let i = 0; i < concepts.length; i += BATCH) {
		proposals.push(...(await judge(concepts.slice(i, i + BATCH))));
		console.log(`  ${Math.min(i + BATCH, concepts.length)}/${concepts.length}`);
	}

	const byLevel = Object.fromEntries(
		[...LEVELS, null].map((l) => [String(l), proposals.filter((p) => p.level === l).length])
	);
	console.log('levels:', byLevel);

	const result = {
		kind: 'assumed-level-proposals',
		created_at: new Date().toISOString(),
		provider: config.llmWritingProvider,
		model: config.llmWritingModel,
		prompt: SYSTEM,
		concepts: concepts.map((c) => ({ ...c, ...proposals.find((p) => p.slug === c.slug) }))
	};
	const text = `${JSON.stringify(result, null, 2)}\n`;
	if (OUT) {
		writeFileSync(OUT, text);
		console.log(`wrote ${OUT}`);
	} else {
		process.stdout.write(text);
	}
	process.exit(0);
}

await main();
