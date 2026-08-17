/**
 * The three verbs a person has that the assistant does not.
 *
 * The point of the file under test is that they are NOT capabilities — the
 * registry is what an agent is offered, and a `delete_*` in it is a delete tool.
 * So what is worth pinning is that they exist for every section, that the two
 * with an undo write it through the same layer the original write used, and that
 * deletion has none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	reordered: [] as { resource: string; order: number[] }[],
	tagged: [] as { resource: string; id: number; tags: string[] | null }[],
	result: { ok: true } as { ok: boolean; error?: string }
};

vi.mock('../write', () => ({
	reorderRows: (resource: string, _actor: unknown, order: number[]) => {
		state.reordered.push({ resource, order });
		return Promise.resolve(state.result);
	},
	setRowTags: (resource: string, _actor: unknown, id: number, tags: string[] | null) => {
		state.tagged.push({ resource, id, tags });
		return Promise.resolve(state.result);
	}
}));

const { UI_ACTIONS, isUiAction } = await import('../ui-actions');
const { PROFILE_RESOURCE_NAMES } = await import('../resources');

const ACTOR = { profileId: 7 };
const TARGET = { id: 5, label: 'Engineer at Acme' };

beforeEach(() => {
	state.reordered = [];
	state.tagged = [];
	state.result = { ok: true };
});

describe('the registry', () => {
	it('covers every section with all three verbs', () => {
		for (const name of PROFILE_RESOURCE_NAMES) {
			for (const verb of ['delete', 'reorder', 'show']) {
				expect(isUiAction(`${verb}_${name}`), `${verb}_${name}`).toBe(true);
			}
		}
	});

	it('is not a capability, so nothing offers these to an agent', async () => {
		// The whole reason this file exists rather than three more entries in
		// PROFILE_CAPABILITIES, which is the list the chat and MCP surfaces are
		// built from.
		const { PROFILE_CAPABILITY_NAMES } = await import('$lib/server/ai-chat/profile-capabilities');
		for (const name of Object.keys(UI_ACTIONS)) {
			expect(PROFILE_CAPABILITY_NAMES as string[]).not.toContain(name);
		}
	});

	it('gives every action a title a person could read', () => {
		for (const [name, def] of Object.entries(UI_ACTIONS)) {
			expect(def.title, name).toMatch(/^[A-Z]/);
			expect(def.title, name).not.toContain('_');
		}
	});
});

describe('what can be put back', () => {
	it('refuses to undo a deletion', () => {
		// Not an oversight and not a TODO: a project owns its technologies and
		// documents by cascade, so a re-create restores the text and none of the
		// things that hung off it. The editors ask before deleting for this reason.
		expect(UI_ACTIONS.delete_work_experience_project.revert).toBeUndefined();
		expect(UI_ACTIONS.delete_language.revert).toBeUndefined();
	});

	it('puts an order back through the same call that changed it', async () => {
		await UI_ACTIONS.reorder_language.revert?.(TARGET, { order: [3, 1, 2] }, ACTOR);

		expect(state.reordered).toEqual([{ resource: 'language', order: [3, 1, 2] }]);
	});

	it('refuses an order it never recorded, rather than reporting a no-op as undone', async () => {
		await expect(UI_ACTIONS.reorder_language.revert?.(TARGET, {}, ACTOR)).rejects.toThrow(
			/not recorded/
		);
		expect(state.reordered).toHaveLength(0);
	});

	it('restores the exact tags a hide replaced', async () => {
		// Exact, not derived: un-hiding through `setProfileOnly` is a merge and
		// would lift a `!resume` the applicant set by hand along with the one the
		// hide wrote. See setRowTags.
		await UI_ACTIONS.show_work_experience.revert?.(TARGET, { tags: ['!resume', 'senior'] }, ACTOR);

		expect(state.tagged).toEqual([
			{ resource: 'work_experience', id: 5, tags: ['!resume', 'senior'] }
		]);
	});

	it('reads a missing tag array as no tags at all', async () => {
		await UI_ACTIONS.show_work_experience.revert?.(TARGET, {}, ACTOR);

		expect(state.tagged).toEqual([{ resource: 'work_experience', id: 5, tags: null }]);
	});

	it('reports a refused write as a thrown error, so the log does not mark it undone', async () => {
		state.result = { ok: false, error: 'Access denied' };

		await expect(
			UI_ACTIONS.show_work_experience.revert?.(TARGET, { tags: [] }, ACTOR)
		).rejects.toThrow('Access denied');
	});
});
