/**
 * The turn's tool set (planning/ASSISTANT-AGENT.md § One registry, two
 * clients): the MCP registry's own tools, bound by the chat with the profile
 * id out of every schema and the server's slice size replaced by the chat's.
 * The registry is real; the three reads a tool list makes are stubbed as in
 * mcp/tools.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/profile/write', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/profile/write')>()),
	parentNames: () => Promise.resolve(['Backend (Python / Django)'])
}));
vi.mock('$lib/server/profile/section-translations', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/profile/section-translations')>()),
	translatedLocales: () => Promise.resolve(['nl'])
}));
vi.mock('$lib/server/ai-chat/tag-capabilities', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai-chat/tag-capabilities')>()),
	libraryVersions: () => Promise.resolve(['citrus'])
}));

import {
	CHAT_HELD_BACK_READS,
	chatReadTools,
	READ_TOOLS,
	toolsFor,
	withoutProfileId
} from '$lib/server/mcp/tools';
import { CHAT_SLICE_CHARS, chatToolSet } from '../tools';

const actor = { profileId: 12, isStaff: false };
const live = (capability: string, id: number, label: string) => ({
	capability: capability as never,
	targets: [{ id, label }],
	current: null
});

describe("the chat's read tools", () => {
	const reads = chatReadTools(CHAT_SLICE_CHARS);
	const required = (name: string) =>
		reads.find((tool) => tool.name === name)!.inputSchema.required ?? [];

	it('are eleven of the fourteen, with the three the chat does not need held back', () => {
		expect(reads.map((tool) => tool.name)).toEqual(
			READ_TOOLS.filter((name) => !(CHAT_HELD_BACK_READS as readonly string[]).includes(name))
		);
		expect(reads).toHaveLength(11);
	});

	it('take no profile_id, since the executor acts for one profile', () => {
		for (const tool of reads) {
			expect(tool.inputSchema.properties, tool.name).not.toHaveProperty('profile_id');
			expect(tool.inputSchema.required ?? [], tool.name).not.toContain('profile_id');
		}
		// The rest of the schema is as the server declares it.
		expect(required('read_activity_entry')).toEqual(['application_id', 'entry_id']);
		expect(required('read_job')).toEqual(['job_id']);
	});

	it("say the chat's slice where the server's size was", () => {
		for (const name of ['read_text', 'read_activity_entry', 'read_document']) {
			const description = reads.find((tool) => tool.name === name)!.description;
			expect(description, name).toContain('6,000');
			expect(description, name).not.toMatch(/60,?000/);
		}
	});

	it("leaves the server's own list as it was", async () => {
		for (const tool of await toolsFor('read')) {
			// All but the one that exists to say which profile the key is bound to.
			if (tool.name === 'list_profile_sections') continue;
			expect(tool.inputSchema.properties, tool.name).toHaveProperty('profile_id');
		}
		expect((await toolsFor('read')).map((tool) => tool.name)).toEqual([...READ_TOOLS]);
	});
});

describe("the turn's tool set", () => {
	it('adds one write tool per live capability, naming the row by its id and no profile', async () => {
		const set = await chatToolSet(
			[live('edit_language', 9, 'Dutch'), live('edit_job_details', 100, 'Data Engineer')],
			actor
		);

		expect(set.reads).toHaveLength(11);
		expect(set.writes).toEqual(['edit_language', 'edit_job_details']);
		expect(set.definitions.map((d) => d.name)).toEqual([...set.reads, ...set.writes]);

		const language = set.definitions.find((d) => d.name === 'edit_language')!;
		const properties = language.parameters.properties as Record<string, unknown>;
		expect(properties).toHaveProperty('entry_id');
		expect(properties).toHaveProperty('language.name');
		expect(properties).toHaveProperty('rationale');
		expect(properties).not.toHaveProperty('profile_id');
		expect(language.parameters.required).toEqual(expect.arrayContaining(['entry_id', 'rationale']));
		expect(language.parameters.required).not.toContain('profile_id');
		// The contract travels in the description, as it does over MCP.
		expect(language.description).toContain('Correct');

		const job = set.definitions.find((d) => d.name === 'edit_job_details')!;
		expect(job.parameters.required).toEqual(expect.arrayContaining(['job_id', 'rationale']));
	});

	it('is in the shape the provider layer binds', async () => {
		const set = await chatToolSet([live('edit_language', 9, 'Dutch')], actor);
		for (const definition of set.definitions) {
			expect(typeof definition.name).toBe('string');
			expect(typeof definition.description).toBe('string');
			expect(definition.parameters.type).toBe('object');
			expect(definition.parameters.additionalProperties).toBe(false);
		}
	});

	it('withholds read_profile_section on an anonymous turn', async () => {
		const set = await chatToolSet([], actor, { anonymous: true });
		expect(set.reads).toHaveLength(10);
		expect(set.reads).not.toContain('read_profile_section');
		expect(set.writes).toEqual([]);
	});

	it('binds nothing a page did not make live', async () => {
		const set = await chatToolSet([], actor);
		expect(set.definitions.map((d) => d.name)).toEqual(set.reads);
	});
});

describe('withoutProfileId', () => {
	it('leaves a tool without one as it is', () => {
		const tool = {
			name: 'x',
			description: 'x',
			inputSchema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
			annotations: {
				title: 'x',
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false
			}
		};
		expect(withoutProfileId(tool)).toEqual(tool);
	});
});
