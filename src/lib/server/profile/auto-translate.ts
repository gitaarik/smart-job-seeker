/**
 * LLM-backed auto-translation of profile fields.
 *
 * Given a batch of English base fields, ask the configured model to localize
 * them into the target language. Chunked so a large profile stays within the
 * model's output budget; proper nouns / tech names are kept as-is by the prompt.
 */

import { z } from "zod";
import { generateChatCompletion } from "$lib/server/llm/langchain";
import { config } from "$lib/server/config";
import { LOCALES } from "$lib/resume-translations";

export interface FieldToTranslate {
  entity: string;
  id: number;
  field: string;
  base: string;
}

const BatchSchema = z.object({
  items: z.array(z.object({ i: z.number(), t: z.string() })),
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
): Promise<Map<number, string>> {
  const language = LOCALES.find((l) => l.code === locale)?.label ?? locale;
  const result = new Map<number, string>();

  for (let start = 0; start < fields.length; start += CHUNK_SIZE) {
    const chunk = fields.slice(start, start + CHUNK_SIZE);
    const items = chunk.map((f, k) => ({ i: start + k, t: f.base }));

    const parsed = await generateChatCompletion<z.infer<typeof BatchSchema>>(
      [
        {
          role: "system",
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
            `4. Achievement and experience lines are CV bullets: render each as a grammatical clause in ` +
            `the natural CV register for ${language}. Use a finite past-tense verb form where the ` +
            `language expects one — do NOT emit an ungrammatical bare participle fragment, and keep the ` +
            `verb tense consistent across all bullets.\n` +
            `5. Preserve every HTML tag, markup token, number, percentage, unit and piece of punctuation ` +
            `exactly; translate only the human-readable text.\n` +
            `6. Output the translation only — no notes, no explanations.`,
        },
        {
          role: "user",
          content:
            `Translate these ${items.length} independent CV fields into ${language}. ` +
            `Return JSON {"items":[{"i":<index>,"t":"<translation>"}]} with exactly one entry per input ` +
            `index and no other keys.\n\n${JSON.stringify(items)}`,
        },
      ],
      {
        model,
        structuredOutput: { name: "translate_fields", schema: BatchSchema },
        temperature: 0.3,
      },
    );

    for (const it of parsed.items ?? []) {
      if (
        typeof it.i === "number" &&
        it.i >= 0 &&
        it.i < fields.length &&
        typeof it.t === "string" &&
        it.t.trim()
      ) {
        result.set(it.i, it.t.trim());
      }
    }
  }

  return result;
}
