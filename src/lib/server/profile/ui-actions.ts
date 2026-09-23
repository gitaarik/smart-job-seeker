/**
 * The one thing a person can do to a section row that no agent can: delete it.
 *
 * The change log resolves an entry to a title and an undo through the
 * capability registry, which is the right answer for the writes that ARE
 * capabilities — a UI edit and a chat edit both land as `edit_work_experience`
 * and both undo the same way. A delete does not: the registry has no delete on
 * purpose. The assistant proposes `hide_*` instead, because a proposal card is
 * accepted in one click and a delete is not recoverable from a before-image.
 *
 * There were three until 2026-09-23. Showing a hidden entry became `show_*`,
 * and reordering a section became `reorder_*` (MCP only, see
 * `reorder-capabilities.ts`). A person's un-hide and reorder are still logged
 * under those names by `write.ts`, so they resolve to the same title and undo
 * as an agent's, the way an edit does.
 *
 * It is declared here rather than added to `PROFILE_CAPABILITIES` because that
 * list is what the assistant and the MCP server are offered. A
 * `delete_work_experience` in it is a delete tool for an agent, which is the
 * one thing the hide-not-delete design refused.
 *
 * ## Why it cannot be put back
 *
 * This is the file that says so out loud rather than leaving the feed to
 * discover it. A work-experience project owns its technologies and any
 * documents attached to it through `ON DELETE CASCADE`, so what a re-create
 * would restore is a row with the same text and none of the things that hung
 * off it. The editors ask before deleting for exactly this reason; the history
 * records it and offers the page instead.
 */

import { PROFILE_RESOURCE_NAMES, PROFILE_RESOURCES, type ProfileResourceName } from './resources';
import type { ProfileActor } from './write';

export type UiActionVerb = 'delete';

export type UiAction = `${UiActionVerb}_${ProfileResourceName}`;

export interface UiActionDef {
	/** Shown in the history, in place of a capability's `title`. */
	title: string;
	/**
	 * Put it back, or absent where nothing can. Same shape as a capability's
	 * `revert` minus the parts only a capability has — the log calls whichever
	 * of the two it resolved.
	 */
	revert?: (
		target: { id: number; label: string },
		previous: Record<string, unknown>,
		actor: ProfileActor
	) => Promise<void>;
}

/**
 * Built as pairs rather than an object literal with computed keys: a computed
 * key erases the value's contextual type, so every `revert` parameter would be
 * implicitly `any` — which is exactly the check this file most wants.
 */
function defsFor(name: ProfileResourceName): Array<[UiAction, UiActionDef]> {
	const { label } = PROFILE_RESOURCES[name];
	return [[`delete_${name}`, { title: `Delete this ${label}` }]];
}

export const UI_ACTIONS: Record<UiAction, UiActionDef> = Object.fromEntries(
	PROFILE_RESOURCE_NAMES.flatMap(defsFor)
) as Record<UiAction, UiActionDef>;

export function isUiAction(name: string): name is UiAction {
	return name in UI_ACTIONS;
}
