/**
 * LLM-backed auto-translation of profile fields.
 *
 * Given a batch of English base fields, ask the configured model to localize
 * them into the target language. Chunked so a large profile stays within the
 * model's output budget; proper nouns / tech names are kept as-is by the prompt.
 */

import { z } from 'zod';
import { generateChatCompletion } from '$lib/server/llm/langchain';
import { config } from '$lib/server/config';
import { LOCALES } from '$lib/resume-translations';

export interface FieldToTranslate {
	entity: string;
	id: number;
	field: string;
	base: string;
}

const BatchSchema = z.object({
	items: z.array(z.object({ i: z.number(), t: z.string() }))
});

/** Fields per LLM call — keeps each response comfortably within output limits. */
const CHUNK_SIZE = 20;

/**
 * Translate `fields` into `locale`. Returns a map from the field's index (in
 * the input array) to its translated string. Missing/blank results are omitted
 * so the caller falls back to English for anything the model skipped.
 */
export async function translateFields(
	fields: FieldToTranslate[],
	locale: string,
	model: string = config.llmTranslateModel,
	provider: string | undefined = config.llmTranslateProvider
): Promise<Map<number, string>> {
	const language = LOCALES.find((l) => l.code === locale)?.label ?? locale;
	const result = new Map<number, string>();

	for (let start = 0; start < fields.length; start += CHUNK_SIZE) {
		const chunk = fields.slice(start, start + CHUNK_SIZE);
		const items = chunk.map((f, k) => ({ i: start + k, t: f.base }));

		const parsed = await generateChatCompletion<z.infer<typeof BatchSchema>>(
			[
				{
					role: 'system',
					content:
						`You are a professional translator localizing a résumé/CV from English into ${language}. ` +
						`Write natural, idiomatic ${language} that a native speaker would put on a professional CV — ` +
						`never word-for-word or calqued. Follow these rules strictly:\n` +
						`1. Translate the full meaning accurately. Never guess, drop, or invent content, and never ` +
						`leave any English word untranslated unless a rule below says to keep it.\n` +
						`2. Keep unchanged: proper nouns; company, product and brand names (e.g. Smart Job Seeker, ` +
						`TicketSwap); technology, framework and tool names (React, PostgreSQL, Docker, Django, ` +
						`LangChain); URLs; and code identifiers.\n` +
						`3. Keep widely-used English job/role titles in the form conventionally used in ${language}'s ` +
						`tech industry (in many languages "Engineer", "Lead", "Full-Stack", "Frontend" stay in ` +
						`English), and translate a given title the same way every time.\n` +
						`4. Keep the common English technical and startup jargon that professionals in ${language} ` +
						`routinely leave untranslated rather than calquing it — e.g. pipeline, deploy, release, ` +
						`performance, coverage, backward compatibility, user engagement, responsive design, ` +
						`web scraping, caching strategies, booking, order, event, founder, and "development" in ` +
						`skill-category names. When in doubt, prefer the exact term a senior developer would write.\n` +
						`5. Achievement and experience lines are CV bullets: render each as a grammatical clause using ` +
						`the SIMPLE PAST tense in ${language} (not the present-perfect/compound-past), applied ` +
						`consistently to every bullet; never emit a bare participle fragment.\n` +
						`6. Prefer natural, native professional phrasing over literal calques (translate idioms like ` +
						`"thrives in…" with an idiomatic equivalent, not word-for-word), and render role/employment ` +
						`terms in their professional sense (e.g. an "independent" engineer in the freelance sense).\n` +
						`7. Preserve every HTML tag, markup token, number, percentage, unit and piece of punctuation ` +
						`exactly; translate only the human-readable text.\n` +
						`8. Output the translation only — no notes, no explanations.`
				},
				{
					role: 'user',
					content:
						`Translate these ${items.length} independent CV fields into ${language}. ` +
						`Return JSON {"items":[{"i":<index>,"t":"<translation>"}]} with exactly one entry per input ` +
						`index and no other keys.\n\n${JSON.stringify(items)}`
				}
			],
			{
				model,
				provider,
				structuredOutput: { name: 'translate_fields', schema: BatchSchema },
				temperature: 0.3
			}
		);

		for (const it of parsed.items ?? []) {
			if (
				typeof it.i === 'number' &&
				it.i >= 0 &&
				it.i < fields.length &&
				typeof it.t === 'string' &&
				it.t.trim()
			) {
				result.set(it.i, it.t.trim());
			}
		}
	}

	return result;
}
