/**
 * Gemini's `responseSchema` takes one `type` per node, and zod 4.5 began
 * writing a union of bare types as a type list. With zod 4.6.5 in the lockfile,
 * every structured Gemini call failed, and every test here stayed green,
 * because the provider is mocked everywhere. So these hold the conversion
 * itself, against the schemas the app really sends.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { aiPromptSchemas } from '$lib/server/schemas/ai-prompt-schemas';
import { geminiResponseSchema, parseStructuredReply } from '../gemini-schema';

/** The paths in a schema where `type` is a list. */
function typeLists(node: unknown, path = '$'): string[] {
	if (Array.isArray(node)) return node.flatMap((v, i) => typeLists(v, `${path}[${i}]`));
	if (node === null || typeof node !== 'object') return [];
	const here = Array.isArray((node as { type?: unknown }).type) ? [path] : [];
	return here.concat(Object.entries(node).flatMap(([k, v]) => typeLists(v, `${path}.${k}`)));
}

const props = (schema: Record<string, unknown>) => schema.properties as Record<string, unknown>;

describe('geminiResponseSchema', () => {
	it('splits a nullable field back into anyOf, keeping its description on the node', () => {
		const out = geminiResponseSchema(z.object({ note: z.string().nullable().describe('A note') }));
		expect(props(out).note).toEqual({
			description: 'A note',
			anyOf: [{ type: 'string' }, { type: 'null' }]
		});
	});

	it('splits a union of bare types wherever it sits', () => {
		const out = geminiResponseSchema(
			z.object({
				rows: z.array(z.object({ v: z.union([z.string(), z.number(), z.null()]) })).nullable()
			})
		);
		expect(typeLists(out)).toEqual([]);
		expect(JSON.stringify(out)).toContain(
			'"v":{"anyOf":[{"type":"string"},{"type":"number"},{"type":"null"}]}'
		);
	});

	// zod merges only bare branches, so anything it left as anyOf is already in
	// the form Gemini takes, and must arrive exactly as zod wrote it.
	it('leaves a union zod did not merge as it was', () => {
		const schema = z.object({ note: z.string().max(10).nullable(), kind: z.enum(['a', 'b']) });
		expect(geminiResponseSchema(schema)).toEqual(toJsonSchema(schema));
	});

	it('treats a property called default as a schema, and a default value as data', () => {
		const out = geminiResponseSchema(
			z.object({
				default: z.string().nullable(),
				shape: z.object({ type: z.array(z.string()) }).default({ type: ['string', 'null'] })
			})
		);
		expect(props(out).default).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] });
		expect((props(out).shape as { default: unknown }).default).toEqual({
			type: ['string', 'null']
		});
	});

	// A schema with a transform cannot be converted at all, so it never reaches
	// Gemini (see fallback.ts); this is about the ones that can.
	it('leaves no type list in any prompt schema that can be sent', () => {
		const sendable = Object.entries(aiPromptSchemas).filter(([, schema]) => {
			try {
				toJsonSchema(schema);
				return true;
			} catch {
				return false;
			}
		});
		// An empty sweep would pass every assertion below.
		expect(sendable.length).toBeGreaterThan(20);
		for (const [name, schema] of sendable) {
			expect(typeLists(geminiResponseSchema(schema)), name).toEqual([]);
		}
	});
});

describe('parseStructuredReply', () => {
	it("returns zod's result, so defaults still apply", async () => {
		const schema = z.object({ reply: z.string(), tone: z.string().default('plain') });
		expect(await parseStructuredReply(schema, { reply: 'Hi.' })).toEqual({
			reply: 'Hi.',
			tone: 'plain'
		});
	});

	// Null is what LangChain's own zod parser gives for a rejected reply with
	// includeRaw, and what the caller reports as no usable structured output.
	it('turns a reply the schema rejects into null', async () => {
		expect(await parseStructuredReply(z.object({ reply: z.string() }), { reply: 42 })).toBeNull();
	});

	it('passes a missing reply through', async () => {
		expect(await parseStructuredReply(z.object({ reply: z.string() }), null)).toBeNull();
	});
});
