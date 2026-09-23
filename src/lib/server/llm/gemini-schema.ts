/**
 * What a structured Gemini call is sent, and how its reply is checked.
 *
 * Gemini's `responseSchema` is an OpenAPI 3.0 subset, where `type` is a single
 * string. zod 4.5 began writing a union of bare types as a JSON Schema type
 * list: `z.string().nullable()` became `{"type": ["string", "null"]}`, where
 * 4.4 wrote `{"anyOf": [{"type": "string"}, {"type": "null"}]}`. Every JSON
 * Schema draft reads the two the same. Gemini refuses the first outright —
 * "Proto field is not repeating, cannot start list" — so every structured
 * Gemini call failed, which is every writing prompt: the assistant, letters,
 * answers, stories. It arrived as a transitive lockfile bump (4.4.3 -> 4.6.5),
 * and CI stayed green because every test mocks the provider.
 *
 * `geminiResponseSchema` undoes that one rewrite and nothing else, so Gemini is
 * sent what it was sent before the bump. The rest of the conversion is still
 * LangChain's, exactly as when the zod schema went to `withStructuredOutput`
 * directly. Two alternatives were not taken:
 *
 *  - Pinning zod below 4.5. better-auth 1.7 requires ^4.5.4, so a pin installs
 *    two copies, and the next bump arrives at the same place.
 *  - zod's own `target: 'openapi-3.0'`. It writes no type lists, but it also
 *    rewrites every nullable as `nullable: true`: a different schema from the
 *    one every writing prompt has run against, for nothing.
 *
 * Sending a JSON Schema instead of the zod one costs LangChain's zod parse of
 * the reply, which `parseStructuredReply` puts back.
 */
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import type { z } from 'zod';

/** Keywords whose value is a map of names to schemas, not a schema itself. */
const SCHEMA_MAPS = new Set([
	'properties',
	'patternProperties',
	'$defs',
	'definitions',
	'dependentSchemas'
]);

/** Keywords whose value is data: a `type` list inside one is a value to keep. */
const DATA = new Set(['enum', 'const', 'default', 'examples', 'required']);

/**
 * zod merges an `anyOf` into a type list only when every branch is a bare
 * `{type}`, and leaves the node's other keywords where they were
 * (`compactTypeUnion` in zod's to-json-schema). So splitting the list back
 * into bare branches, with those keywords left on the node, is its exact
 * inverse.
 */
function splitTypeLists(schema: unknown): unknown {
	if (Array.isArray(schema)) return schema.map(splitTypeLists);
	if (schema === null || typeof schema !== 'object') return schema;

	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(schema)) {
		if (DATA.has(key)) out[key] = value;
		else if (SCHEMA_MAPS.has(key) && value !== null && typeof value === 'object') {
			out[key] = Object.fromEntries(
				Object.entries(value).map(([name, child]) => [name, splitTypeLists(child)])
			);
		} else out[key] = splitTypeLists(value);
	}

	const { type, ...rest } = out;
	if (!Array.isArray(type)) return out;
	return { ...rest, anyOf: type.map((t) => ({ type: t })) };
}

/** The response schema for a structured Gemini call. */
export function geminiResponseSchema(schema: z.ZodType): Record<string, unknown> {
	return splitTypeLists(toJsonSchema(schema)) as Record<string, unknown>;
}

/**
 * Hold a reply parsed against a plain JSON Schema to the zod schema, as
 * LangChain's own parser does when it is handed zod.
 *
 * A reply the schema rejects comes back as null, which is what LangChain gives
 * for it with `includeRaw`, so it fails the same way as before: as a
 * generation that returned no usable structured output. The zod result is
 * returned rather than the raw object, so defaults and preprocessing still
 * apply.
 */
export async function parseStructuredReply(schema: z.ZodType, parsed: unknown): Promise<unknown> {
	if (parsed === null || parsed === undefined) return parsed;
	const checked = await schema.safeParseAsync(parsed);
	return checked.success ? checked.data : null;
}
