/**
 * The checks a proposal passes before it is stored, shared by the structured
 * reply's list and the agent's write calls (planning/ASSISTANT-AGENT.md,
 * Phase 2). The registry is stubbed to two capabilities, as the route's test
 * stubs it, so the checks are tested and not the capabilities.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/ai-chat/capabilities', () => ({
	CAPABILITIES: {
		edit_language: {
			title: 'Correct this language',
			fields: { 'language.name': 'string', 'language.proficiency': 'string' },
			validate: () => ({ ok: true }),
			current: () => Promise.resolve({ 'language.name': 'Dutch', 'language.proficiency': 'B2' })
		},
		edit_job_details: {
			title: "Edit the job's details",
			fields: { title: 'string', salary_min: 'int' },
			validate: (fields: Record<string, unknown>) =>
				fields.title === '' || fields.title === null
					? { ok: false, error: 'Title cannot be empty' }
					: { ok: true }
		},
		hide_language: {
			title: 'Hide this language',
			fields: {},
			validate: () => ({ ok: true }),
			current: () => Promise.resolve({})
		}
	},
	fieldsFromChanges: (capability: string, changes: { field: string; value: unknown }[]) => {
		const known: Record<string, string[]> = {
			edit_language: ['language.name', 'language.proficiency'],
			edit_job_details: ['title', 'salary_min'],
			hide_language: []
		};
		return Object.fromEntries(
			changes.filter((c) => known[capability].includes(c.field)).map((c) => [c.field, c.value])
		);
	}
}));

import { dedupeProposals, readProposal, renderDropNotice } from '../proposals';

const actor = { profileId: 12, isStaff: false };
const job = {
	capability: 'edit_job_details' as never,
	targets: [{ id: 3818, label: 'Data Engineer at Testco' }],
	current: { title: 'Data Engineer', salary_min: 5 }
};
const languages = {
	capability: 'edit_language' as never,
	targets: [
		{ id: 9, label: 'Dutch' },
		{ id: 10, label: 'German' }
	],
	current: null
};

describe('readProposal', () => {
	it('stores the capability, the row, the coerced fields and their before-image', async () => {
		const read = await readProposal(
			{
				capability: 'edit_job_details',
				rationale: 'You asked.',
				changes: [{ field: 'salary_min', value: 6 }]
			},
			[job],
			actor
		);
		expect(read).toEqual({
			ok: true,
			proposal: {
				capability: 'edit_job_details',
				rationale: 'You asked.',
				fields: { salary_min: 6 },
				previous: { salary_min: 5 },
				target: { id: 3818, label: 'Data Engineer at Testco' }
			}
		});
	});

	it('reads the named row for its before-image when the capability is live over several', async () => {
		const read = await readProposal(
			{
				capability: 'edit_language',
				target_id: 10,
				rationale: 'r',
				changes: [{ field: 'language.proficiency', value: 'C1' }]
			},
			[languages],
			actor
		);
		expect(read).toMatchObject({
			ok: true,
			proposal: { target: { id: 10, label: 'German' }, previous: { 'language.proficiency': 'B2' } }
		});
	});

	it('refuses a capability that was not live on this turn, by its title', async () => {
		const read = await readProposal(
			{ capability: 'edit_language', rationale: 'r', changes: [] },
			[job],
			actor
		);
		expect(read).toEqual({
			ok: false,
			drop: {
				what: 'Correct this language',
				why: "that isn't something you can change from this page"
			}
		});
	});

	it('refuses one that named nothing, with no title to give it', async () => {
		expect(await readProposal({}, [job], actor)).toEqual({
			ok: false,
			drop: { what: null, why: "it didn't name a change to make" }
		});
	});

	it('needs the row named when several are live, and only from the list', async () => {
		const unnamed = await readProposal(
			{
				capability: 'edit_language',
				rationale: 'r',
				changes: [{ field: 'language.name', value: 'x' }]
			},
			[languages],
			actor
		);
		expect(unnamed).toMatchObject({
			ok: false,
			drop: { why: "it didn't say which one to change" }
		});

		const elsewhere = await readProposal(
			{ capability: 'edit_language', target_id: 11, rationale: 'r', changes: [] },
			[languages],
			actor
		);
		expect(elsewhere).toMatchObject({
			ok: false,
			drop: { why: "it named one that isn't on this page" }
		});
	});

	it('forgives a stray id when one row is live, unless the caller is strict', async () => {
		const candidate = {
			capability: 'edit_job_details',
			target_id: 1,
			rationale: 'r',
			changes: [{ field: 'salary_min', value: 6 }]
		};
		expect(await readProposal(candidate, [job], actor)).toMatchObject({
			ok: true,
			proposal: { target: { id: 3818 } }
		});
		expect(await readProposal(candidate, [job], actor, { strictTarget: true })).toMatchObject({
			ok: false,
			drop: { why: "it named one that isn't on this page" }
		});
		// The right id is fine either way.
		expect(
			await readProposal({ ...candidate, target_id: 3818 }, [job], actor, { strictTarget: true })
		).toMatchObject({ ok: true });
	});

	it('drops one that came back with no usable fields, and keeps a fieldless verb', async () => {
		const empty = await readProposal(
			{
				capability: 'edit_job_details',
				rationale: 'r',
				changes: [{ field: 'elsewhere', value: 1 }]
			},
			[job],
			actor
		);
		expect(empty).toMatchObject({ ok: false, drop: { why: 'it came back with no usable fields' } });

		const hide = await readProposal(
			{ capability: 'hide_language', target_id: 9, rationale: 'r', changes: [] },
			[
				{
					capability: 'hide_language' as never,
					targets: [{ id: 9, label: 'Dutch' }],
					current: null
				}
			],
			actor
		);
		expect(hide).toMatchObject({ ok: true, proposal: { fields: {} } });
	});

	it("drops what the capability's own validate refuses, with its reason", async () => {
		const read = await readProposal(
			{ capability: 'edit_job_details', rationale: 'r', changes: [{ field: 'title', value: '' }] },
			[job],
			actor
		);
		expect(read).toEqual({
			ok: false,
			drop: { what: "Edit the job's details", why: 'Title cannot be empty' }
		});
	});
});

describe('dedupeProposals', () => {
	it('keeps one card per capability and row, and both rows of one capability', () => {
		const p = (capability: string, id: number) => ({
			capability,
			rationale: '',
			fields: {},
			previous: {},
			target: { id, label: '' }
		});
		expect(
			dedupeProposals([p('edit_language', 9), p('edit_language', 10), p('edit_language', 9)])
		).toEqual([p('edit_language', 9), p('edit_language', 10)]);
	});
});

describe('renderDropNotice', () => {
	it('is empty for no drops and names each drop in the user’s terms', () => {
		expect(renderDropNotice([])).toBe('');
		const notice = renderDropNotice([
			{ what: 'Correct this language', why: 'it named one that isn’t on this page' },
			{ what: null, why: 'it didn’t name a change to make' }
		]);
		expect(notice).toContain("*Some changes I described couldn't be offered:*");
		expect(notice).toContain('- **Correct this language** — it named one that isn’t on this page.');
		expect(notice).toContain("- One change didn't come through: it didn’t name a change to make.");
	});
});
