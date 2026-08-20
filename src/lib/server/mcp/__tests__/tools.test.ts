/**
 * Tests for the tool list — the part of this server an agent reads before it
 * does anything, and the part no runtime check can correct.
 *
 * A wrong schema here is not a failed call. It is an agent that never makes the
 * call, or makes it with the wrong argument name and is told "no recognised
 * fields" by a server that could have said so in the schema.
 */
import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '$lib/server/ai-chat/capabilities';
import { ENTITY_CAPABILITY_NAMES, targetingFor } from '../entities';
import {
	DOCUMENT_TOOLS,
	isReadTool,
	MCP_CAPABILITIES,
	READ_TOOLS,
	sectionFor,
	toolsFor
} from '../tools';

const write = toolsFor('write');
const byName = new Map(write.map((tool) => [tool.name, tool]));

describe('what is exposed', () => {
	it('offers every capability in the registry', () => {
		// The claim this file exists to keep honest: for one release the five job
		// and application verbs were in the registry and not on this server, and
		// nothing failed when they were left out.
		expect(new Set(MCP_CAPABILITIES)).toEqual(new Set(Object.keys(CAPABILITIES)));
	});

	it('gives a read key the reads and nothing else', () => {
		const read = toolsFor('read');
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
	it('hides the document tools from a record key', () => {
		const names = toolsFor('write', 'record').map((tool) => tool.name);
		for (const hidden of DOCUMENT_TOOLS) expect(names, hidden).not.toContain(hidden);
	});

	it('shows them to a documents key', () => {
		const names = toolsFor('write', 'documents').map((tool) => tool.name);
		for (const shown of DOCUMENT_TOOLS) expect(names, shown).toContain(shown);
	});

	it('leaves the write tools alone either way', () => {
		// The two dimensions are independent: narrowing what a key SEES must not
		// quietly narrow what it may change, or the grading stops being readable.
		const record = toolsFor('write', 'record').map((t) => t.name);
		const documents = toolsFor('write', 'documents').map((t) => t.name);
		for (const capability of MCP_CAPABILITIES) {
			expect(record, capability).toContain(capability);
			expect(documents, capability).toContain(capability);
		}
	});

	it('gives a read-only record key the narrowest surface there is', () => {
		const names = toolsFor('read', 'record').map((tool) => tool.name);
		expect(names.every((name) => isReadTool(name))).toBe(true);
		expect(names).toEqual(
			READ_TOOLS.filter((n) => !(DOCUMENT_TOOLS as readonly string[]).includes(n))
		);
	});
});
