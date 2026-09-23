/**
 * The two verbs a person has that the assistant does not.
 *
 * The point of the file under test is that they are NOT capabilities — the
 * registry is what an agent is offered, and a `delete_*` in it is a delete tool.
 * So what is worth pinning is that they exist for every section, that a
 * reorder's undo writes through the same layer the original write used, and that
 * deletion has none. Showing a hidden entry used to be a third; its undo is
 * tested with `show_*` in the registry now.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	reordered: [] as { resource: string; order: number[] }[],
	result: { ok: true } as { ok: boolean; error?: string }
};

vi.mock('../write', () => ({
	reorderRows: (resource: string, _actor: unknown, order: number[]) => {
		state.reordered.push({ resource, order });
		return Promise.resolve(state.result);
	}
}));

const { UI_ACTIONS, isUiAction } = await import('../ui-actions');
const { PROFILE_RESOURCE_NAMES } = await import('../resources');

const ACTOR = { profileId: 7 };
const TARGET = { id: 5, label: 'Engineer at Acme' };

beforeEach(() => {
	state.reordered = [];
	state.result = { ok: true };
});

describe('the registry', () => {
	it('covers every section with both verbs', () => {
		for (const name of PROFILE_RESOURCE_NAMES) {
			for (const verb of ['delete', 'reorder']) {
				expect(isUiAction(`${verb}_${name}`), `${verb}_${name}`).toBe(true);
			}
		}
	});

	it('is not a capability, so nothing offers these to an agent', async () => {
		// The whole reason this file exists rather than more entries in
		// PROFILE_CAPABILITIES, which is the list the chat and MCP surfaces are
		// built from.
		const { PROFILE_CAPABILITY_NAMES } = await import('$lib/server/ai-chat/profile-capabilities');
		for (const name of Object.keys(UI_ACTIONS)) {
			expect(PROFILE_CAPABILITY_NAMES as string[]).not.toContain(name);
		}
	});

	it('leaves showing to the registry, where a page’s un-hide and an agent’s meet', async () => {
		// `setRowVisible(…, true)` logs `show_<section>` whoever called it. With
		// the name in both lists the history would pick one by lookup order.
		const { PROFILE_CAPABILITY_NAMES } = await import('$lib/server/ai-chat/profile-capabilities');
		expect(isUiAction('show_work_experience')).toBe(false);
		expect(PROFILE_CAPABILITY_NAMES as string[]).toContain('show_work_experience');
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
});
