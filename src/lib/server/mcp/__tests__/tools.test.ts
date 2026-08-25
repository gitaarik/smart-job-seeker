/**
 * Tests for the tool list — the part of this server an agent reads before it
 * does anything, and the part no runtime check can correct.
 *
 * A wrong schema here is not a failed call. It is an agent that never makes the
 * call, or makes it with the wrong argument name and is told "no recognised
 * fields" by a server that could have said so in the schema.
 */
import { describe, expect, it } from 'vitest';
import { APP_AREAS } from '$lib/server/ai-chat/ability-manifest';
import { CAPABILITIES } from '$lib/server/ai-chat/capabilities';
import { ENTITY_CAPABILITY_NAMES, targetingFor } from '../entities';
import {
	DOCUMENT_TOOLS,
	instructionsFor,
	isReadTool,
	MCP_CAPABILITIES,
	pageFor,
	READ_TOOLS,
	sectionFor,
	toolsFor,
	UPLOAD_TOOL
} from '../tools';

const write = await toolsFor('write');
const byName = new Map(write.map((tool) => [tool.name, tool]));

describe('what is exposed', () => {
	it('offers every capability in the registry', () => {
		// The claim this file exists to keep honest: for one release the five job
		// and application verbs were in the registry and not on this server, and
		// nothing failed when they were left out.
		expect(new Set(MCP_CAPABILITIES)).toEqual(new Set(Object.keys(CAPABILITIES)));
	});

	it('gives a read key the reads and nothing else', async () => {
		const read = await toolsFor('read');
		expect(read.map((tool) => tool.name)).toEqual([...READ_TOOLS]);
		expect(read.every((tool) => isReadTool(tool.name))).toBe(true);
	});

	it('names every tool once', () => {
		expect(byName.size).toBe(write.length);
	});

	it('lets no tool accept an argument it does not declare', () => {
		// A client that invents an argument gets an error rather than having it
		// dropped — the difference between an agent that corrects itself and one
		// that reports success having written nothing.
		expect(write.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
	});
});

describe('the upload door', () => {
	it('is offered to a key that can write, and to no read key', async () => {
		expect(byName.get(UPLOAD_TOOL)).toBeDefined();

		const read = await toolsFor('read');
		expect(read.map((tool) => tool.name)).not.toContain(UPLOAD_TOOL);
	});

	it('is not a capability, and takes no rationale', () => {
		// It writes nothing itself — the bytes are written by /api/mcp/upload — so
		// there is no row to diff and nothing for a tier to grade.
		expect(MCP_CAPABILITIES).not.toContain(UPLOAD_TOOL);
		expect(byName.get(UPLOAD_TOOL)!.inputSchema.required).toEqual([
			'profile_id',
			'application_id',
			'entry_id',
			'filename'
		]);
	});

	it('tells the agent not to send the file through itself', () => {
		// The failure this description exists to prevent: an agent base64ing a
		// 3MB scan into a tool argument and blowing its own context.
		const description = byName.get(UPLOAD_TOOL)!.description;
		expect(description).toContain('never pass through you');
		expect(description).toContain('PUT');
	});
});

describe('how a write names its row', () => {
	it('gives a job or an application capability its own id argument', () => {
		for (const capability of ENTITY_CAPABILITY_NAMES) {
			const tool = byName.get(capability);
			const targeting = targetingFor(capability)!;

			expect(tool, `${capability} is not exposed`).toBeDefined();
			expect(tool!.inputSchema.required).toContain(targeting.arg);
			// Never the profile-section spelling: `entry_id` on add_activity_record
			// would read as the entry being added rather than the application it is
			// filed under, which is the one thing about that tool worth getting right.
			expect(tool!.inputSchema.required).not.toContain('entry_id');
		}
	});

	it('still makes an add to an application name the application', () => {
		// Every other add takes no id at all, because the key says which profile.
		// An application is not implied by anything.
		expect(byName.get('add_activity_record')!.inputSchema.required).toContain('application_id');
		expect(byName.get('add_language')!.inputSchema.required).not.toContain('entry_id');
	});

	it('makes the one that CREATES an application name nothing at all', () => {
		// The third shape on this server: not an entity capability, because there
		// is no row to name, and not a generated profile one either. The key says
		// which profile, and everything else is a field.
		const required = byName.get('add_application')!.inputSchema.required ?? [];
		expect(required).not.toContain('application_id');
		expect(required).not.toContain('entry_id');
		expect(required).toEqual(['profile_id', 'rationale']);
	});

	it('tells the create capability where to read what it might duplicate', () => {
		// Its contract says to check what exists; the chat shows that list under
		// the block, and a tool description has no "below" to show it in.
		expect(byName.get('add_application')!.description).toContain('call list_applications');
	});

	it('sends a wrongly-created application to the list it lives on', () => {
		// Without this the applied-result carries no "remove it again from…" line,
		// because an add has no undo and `sectionFor` has no section to slice.
		expect(pageFor('add_application')).toEqual({ name: 'Applications', path: '/applications' });
	});

	it('keeps entry_id for the sections it was written for', () => {
		expect(byName.get('edit_work_experience')!.inputSchema.required).toContain('entry_id');
	});

	it('requires a profile and a rationale of every write', () => {
		for (const capability of MCP_CAPABILITIES) {
			const required = byName.get(capability)!.inputSchema.required ?? [];
			expect(required, capability).toContain('profile_id');
			expect(required, capability).toContain('rationale');
		}
	});

	it('declares each capability’s own fields, under the names it coerces', () => {
		for (const capability of MCP_CAPABILITIES) {
			const properties = byName.get(capability)!.inputSchema.properties ?? {};
			for (const field of Object.keys(CAPABILITIES[capability].fields)) {
				expect(Object.keys(properties), capability).toContain(field);
			}
		}
	});
});

describe('sectionFor', () => {
	it('answers null for a capability that is not about a section', () => {
		// It used to cast: `edit_job_details` sliced to "job_details" and was
		// declared a ProfileResourceName. Every caller compared it to a real
		// section name and got the right answer for the wrong reason.
		for (const capability of ENTITY_CAPABILITY_NAMES) {
			expect(sectionFor(capability), capability).toBeNull();
		}
	});

	it('still answers with the section for a generated one', () => {
		expect(sectionFor('edit_work_experience')).toBe('work_experience');
		expect(sectionFor('hide_side_project')).toBe('side_project');
	});
});

describe('what a read scope is shown', () => {
	it('hides the document tools from a record key', async () => {
		const names = (await toolsFor('write', 'record')).map((tool) => tool.name);
		for (const hidden of DOCUMENT_TOOLS) expect(names, hidden).not.toContain(hidden);
	});

	it('shows them to a documents key', async () => {
		const names = (await toolsFor('write', 'documents')).map((tool) => tool.name);
		for (const shown of DOCUMENT_TOOLS) expect(names, shown).toContain(shown);
	});

	it('leaves the write tools alone either way', async () => {
		// The two dimensions are independent: narrowing what a key SEES must not
		// quietly narrow what it may change, or the grading stops being readable.
		const record = (await toolsFor('write', 'record')).map((t) => t.name);
		const documents = (await toolsFor('write', 'documents')).map((t) => t.name);
		for (const capability of MCP_CAPABILITIES) {
			expect(record, capability).toContain(capability);
			expect(documents, capability).toContain(capability);
		}
	});

	it('gives a read-only record key the narrowest surface there is', async () => {
		const names = (await toolsFor('read', 'record')).map((tool) => tool.name);
		expect(names.every((name) => isReadTool(name))).toBe(true);
		expect(names).toEqual(
			READ_TOOLS.filter((n) => !(DOCUMENT_TOOLS as readonly string[]).includes(n))
		);
	});
});

describe('what the client is told before it sees a tool', () => {
	it('routes a question through the reads it needs', () => {
		// The gap this closes: every other "read this first" in the server is
		// conditioned on a write, so a question that only reads was steered by
		// nothing at all.
		const instructions = instructionsFor('documents');

		expect(instructions).toContain('read_application');
		expect(instructions).toContain('read_job');
		expect(instructions).toContain('read_profile_section');
	});

	it('names no tool a record key cannot call', () => {
		// Same rule as the tool list: pointing an agent at a tool it will never be
		// shown is a retry it has no way to avoid.
		const instructions = instructionsFor('record');
		for (const hidden of DOCUMENT_TOOLS) expect(instructions, hidden).not.toContain(hidden);
	});

	it('still names them to a documents key', () => {
		const instructions = instructionsFor('documents');
		expect(instructions).toContain('read_activity_entry');
		expect(instructions).toContain('list_documents');
	});

	it('names the parts of the product that have no tool', () => {
		// An agent reads a missing tool as a missing feature, and tells the
		// applicant their own app cannot import jobs. Naming the page turns that
		// into an answer; the list is the one the in-app assistant is given, so
		// the two cannot disagree about what the product does.
		const instructions = instructionsFor('documents');
		for (const area of APP_AREAS) {
			expect(instructions, area.name).toContain(`${area.name} (${area.path})`);
		}
	});

	it('hands over the approval link rather than only the news', () => {
		// The URL comes back on every proposal, but what the standing contract
		// prescribes is "say it is waiting" — and a batch of proposals summarised
		// at the end is exactly where the per-call links get dropped.
		for (const scope of ['record', 'documents'] as const) {
			expect(instructionsFor(scope), scope).toContain('review_at');
		}
	});

	it('keeps what is true of every key at either scope', () => {
		for (const scope of ['record', 'documents'] as const) {
			const instructions = instructionsFor(scope);
			expect(instructions, scope).toContain('list_profile_sections');
			expect(instructions, scope).toContain('Do not invent history');
		}
	});
});
