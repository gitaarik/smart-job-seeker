/**
 * The one verb a person has that no agent does: delete.
 *
 * The point of the file under test is that it is NOT a capability — the
 * registry is what an agent is offered, and a `delete_*` in it is a delete tool.
 * So what is worth pinning is that it exists for every section, that it has no
 * undo, and that the two verbs which used to live beside it (showing and
 * reordering) now resolve through the registry instead. Their undos are tested
 * there, with `show_*` and `reorder_*`.
 */

import { describe, expect, it, vi } from 'vitest';

// Nothing here writes any more, but the registry this test imports to compare
// against does, and a unit test must not reach a database.
vi.mock('../write', () => ({}));

const { UI_ACTIONS, isUiAction } = await import('../ui-actions');
const { PROFILE_RESOURCE_NAMES } = await import('../resources');

describe('the registry', () => {
	it('covers every section with a delete', () => {
		for (const name of PROFILE_RESOURCE_NAMES) {
			expect(isUiAction(`delete_${name}`), `delete_${name}`).toBe(true);
		}
	});

	it('is not a capability, so nothing offers a delete to an agent', async () => {
		// The whole reason this file exists rather than more entries in the
		// registry, which is the list the chat and MCP surfaces are built from.
		const { PROFILE_CAPABILITY_NAMES } = await import('$lib/server/ai-chat/profile-capabilities');
		const { REORDER_CAPABILITY_NAMES } = await import('$lib/server/ai-chat/reorder-capabilities');
		const offered: string[] = [...PROFILE_CAPABILITY_NAMES, ...REORDER_CAPABILITY_NAMES];

		for (const name of Object.keys(UI_ACTIONS)) {
			expect(offered).not.toContain(name);
		}
	});

	it('leaves showing and reordering to the registry, where a person’s and an agent’s meet', async () => {
		// `write.ts` logs `show_<section>` and `reorder_<section>` whoever called
		// it. With a name in both lists the history would pick one by lookup order.
		const { PROFILE_CAPABILITY_NAMES } = await import('$lib/server/ai-chat/profile-capabilities');
		const { REORDER_CAPABILITY_NAMES } = await import('$lib/server/ai-chat/reorder-capabilities');

		expect(isUiAction('show_work_experience')).toBe(false);
		expect(isUiAction('reorder_language')).toBe(false);
		expect(PROFILE_CAPABILITY_NAMES as string[]).toContain('show_work_experience');
		expect(REORDER_CAPABILITY_NAMES as string[]).toContain('reorder_language');
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
});
