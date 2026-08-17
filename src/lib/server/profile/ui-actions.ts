/**
 * The three things a person can do to a section row that the assistant cannot.
 *
 * The change log resolves an entry to a title and an undo through the
 * capability registry, which is the right answer for the writes that ARE
 * capabilities — a UI edit and a chat edit both land as `edit_work_experience`
 * and both undo the same way. Three do not:
 *
 *  - **delete** — the registry has no delete on purpose. The assistant proposes
 *    `hide_*` instead, because a proposal card is accepted in one click and a
 *    delete is not recoverable from a before-image.
 *  - **reorder** — a section-wide write with no single row to name.
 *  - **show** — the other half of hide. `setRowVisible(…, true)` is a distinct
 *    thing that happened and logging it as a hide would print the wrong verb.
 *
 * They are declared here rather than added to `PROFILE_CAPABILITIES` because
 * that list is what the assistant and the MCP server are offered. A
 * `delete_work_experience` in it is a delete tool for an agent, which is the
 * one thing the hide-not-delete design refused.
 *
 * ## What can be put back
 *
 * A reorder can: the before-image is the order it was in, and writing it back
 * is the same call that changed it. Showing can, by restoring the exact tag
 * array — the same restore `hide_*` uses, and exact rather than derived for the
 * reason recorded on `setRowTags`.
 *
 * A delete cannot, and this is the file that says so out loud rather than
 * leaving the feed to discover it. A work-experience project owns its
 * technologies and any documents attached to it through `ON DELETE CASCADE`, so
 * what a re-create would restore is a row with the same text and none of the
 * things that hung off it. The editors ask before deleting for exactly this
 * reason; the history records it and offers the page instead.
 */

import { PROFILE_RESOURCE_NAMES, PROFILE_RESOURCES, type ProfileResourceName } from './resources';
import { reorderRows, setRowTags, type ProfileActor } from './write';

export type UiActionVerb = 'delete' | 'reorder' | 'show';

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
	const { label, title } = PROFILE_RESOURCES[name];

	const remove: UiActionDef = { title: `Delete this ${label}` };

	const reorder: UiActionDef = {
		title: `Reorder ${title.toLowerCase()}`,
		revert: async (_target, previous, actor) => {
			const order = Array.isArray(previous.order) ? (previous.order as number[]) : [];
			// An empty order is not a no-op worth attempting: `reorderRows` would
			// write nothing and report success, and the history would mark the entry
			// undone having done nothing.
			if (order.length === 0) throw new Error('That order was not recorded.');
			const result = await reorderRows(name, actor, order);
			if (!result.ok) throw new Error(result.error);
		}
	};

	const show: UiActionDef = {
		title: `Show this ${label} again`,
		revert: async (target, previous, actor) => {
			const tags = Array.isArray(previous.tags) ? (previous.tags as string[]) : null;
			const result = await setRowTags(name, actor, target.id, tags);
			if (!result.ok) throw new Error(result.error);
		}
	};

	return [
		[`delete_${name}`, remove],
		[`reorder_${name}`, reorder],
		[`show_${name}`, show]
	];
}

export const UI_ACTIONS: Record<UiAction, UiActionDef> = Object.fromEntries(
	PROFILE_RESOURCE_NAMES.flatMap(defsFor)
) as Record<UiAction, UiActionDef>;

export function isUiAction(name: string): name is UiAction {
	return name in UI_ACTIONS;
}
