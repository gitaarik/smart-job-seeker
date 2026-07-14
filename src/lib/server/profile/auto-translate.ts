/**
 * LLM-backed auto-translation of profile fields.
 *
 * Given a batch of English base fields, ask the configured model to localize
 * them into the target language. Chunked so a large profile stays within the
 * model's output budget; proper nouns / tech names are kept as-is by the prompt.
 */

import { z } from "zod";
import { generateChatCompletion } from "$lib/server/llm/langchain";
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
            `Translate each item's text naturally and idiomatically, preserving meaning, professional tone, ` +
            `and any inline formatting or punctuation. Keep proper nouns, company names, product names, and ` +
            `technology names (e.g. React, PostgreSQL, Docker, Kubernetes) in their original form. ` +
            `Do not add, omit, or explain anything — translate only.`,
        },
        {
          role: "user",
          content:
            `Translate these ${items.length} items into ${language}. ` +
            `Return JSON {"items":[{"i":<index>,"t":"<translation>"}]} with exactly one entry per input ` +
            `index and no other keys.\n\n${JSON.stringify(items)}`,
        },
      ],
      {
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
