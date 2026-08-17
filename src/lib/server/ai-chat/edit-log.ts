/**
 * What has changed a profile, and how to put it back.
 *
 * HTTP-free, like `executeCapability` and for the same reason: the page that
 * shows the feed is the only caller today and should not also be the only place
 * the rules are written down. An MCP server exposing "what have you changed?"
 * and "undo that" calls these.
 *
 * ## It used to be only the assistant's history
 *
 * And it said so: a `ui` source would have been "a claim nobody makes", because
 * form actions write through `profile/write.ts` and never reach the registry.
 * They still don't — `write.ts` records for itself now (see `change-log.ts`),
 * which is what turns this from an account of what the assistant did into an
 * account of what happened. The two land as the same action name where they are
 * the same write: an edit is `edit_work_experience` whether a person or a
 * proposal made it, and undoes identically either way.
 *
 * Three things only a person can do have no capability to name them — deleting,
 * reordering, and showing something hidden. They are resolved here through
 * `UI_ACTIONS`, which is deliberately not part of the registry: that list is
 * what an agent is offered, and a `delete_*` in it is a delete tool.
 *
 * ## Recording is not optional, and it is not the caller's job
 *
 * `recordChange` is called from inside `executeCapability` and from inside each
 * of `write.ts`'s writes, after the write. Every surface therefore logs by
 * construction rather than by remembering to — which is the property the whole
 * table exists for, since the surface that most needs logging is the one nobody
 * is watching.
 *
 * It is also why a failure to log does not fail the write. The change already
 * happened; throwing there would report failure for something that succeeded,
 * and the caller would reasonably retry it. A missing log row is bad, and a
 * double-applied edit is worse.
 *
 * ## What undo means here
 *
 * `revertEdit` writes the before-image back through the capability's own
 * `revert`, which goes through the same ownership check as the original write —
 * a log row is a record, not a licence. Rights are re-asked because they are
 * lost inside the window this feed spans, not only outside it.
 *
 * It restores the recorded state, so it overwrites anything that happened
 * since. That is what undo is, and it is why the feed shows the timestamp and
 * the before-image next to the button rather than only a verb.
 *
 * Not every action has one. `add_*` deliberately does not: the row is on its own
 * page with a delete control, and giving the registry a delete is the one thing
 * the hide-not-delete design refused. Nor does `delete_*`, for a harder reason —
 * a project owns its technologies and documents by cascade, so a re-create would
 * restore the text and none of the things that hung off it. The feed says where
 * to go instead, the same way the manifest names a page it cannot reach.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { capability_edits } from '$lib/server/db/schema';
import { recordChange, type EditSource } from '$lib/server/profile/change-log';
import { isUiAction, UI_ACTIONS, type UiAction } from '$lib/server/profile/ui-actions';
import { PROFILE_RESOURCES, type ProfileResourceName } from '$lib/server/profile/resources';
import {
	CAPABILITIES,
	describeFieldChanges,
	describeProposalChanges,
	type Capability,
	type CapabilityActor,
	type ProposedChange
} from './capabilities';

export type { EditSource };

/** Anything the history can hold: a capability, or one of the UI-only verbs. */
export type LoggedAction = Capability | UiAction;

export interface EditLogEntry {
	id: number;
	capability: LoggedAction;
	source: EditSource;
	target: { id: number; label: string };
	fields: Record<string, unknown>;
	previous: Record<string, unknown>;
	revertedAt: Date | null;
	createdAt: Date;
	/** What the capability calls itself, for a feed that shouldn't print `edit_work_experience`. */
	title: string;
	/** Whether this one can be put back — see the note above on why some cannot. */
	revertible: boolean;
}

/** Newest first. */
const DEFAULT_LIMIT = 50;

/**
 * Record a capability's write.
 *
 * The row is built in `change-log.ts`, which knows nothing about capabilities —
 * `write.ts` records through it too, and importing this module from there would
 * close a circle through the registry. This is the capability-shaped door onto
 * it, kept so `executeCapability` reads as it always did.
 */
export async function recordEdit(opts: {
	profileId: number;
	source: EditSource;
	capability: Capability;
	target: { id: number; label: string };
	fields: Record<string, unknown>;
	previous: Record<string, unknown>;
}): Promise<number> {
	return recordChange({ ...opts, action: opts.capability });
}

/**
 * What an entry means: its title, and the undo if it has one.
 *
 * Two registries, because two things write here. A capability where the action
 * is something the assistant could also have done, and `UI_ACTIONS` for the
 * three verbs only a person has. Null for neither — a capability can be removed
 * from the registry while its history stays (`hide_language` was one for a day),
 * and the row still describes what happened; it just cannot be named or undone.
 */
function definitionFor(action: string): { title: string; revert?: unknown } | null {
	if (action in CAPABILITIES) return CAPABILITIES[action as Capability];
	return isUiAction(action) ? UI_ACTIONS[action] : null;
}

function toEntry(row: typeof capability_edits.$inferSelect): EditLogEntry {
	const action = row.capability as LoggedAction;
	const def = definitionFor(action);

	return {
		id: row.id,
		capability: action,
		source: row.source as EditSource,
		target: row.target,
		fields: row.fields,
		previous: row.previous,
		revertedAt: row.reverted_at,
		createdAt: row.date_created,
		title: def?.title ?? action,
		revertible: !!def?.revert && !row.reverted_at
	};
}

/**
 * One entry's field-level diff, whichever registry wrote it.
 *
 * ## The two sources spell their fields differently
 *
 * A capability records what the model proposed, and the model is given
 * namespaced names — `work_experience_project.outcome` — because one proposal
 * schema carries every live capability's fields and several sections have a
 * `summary`. `write.ts` records columns, because that is what it wrote. Same
 * action, same undo, two key shapes, and describing one with the other's field
 * list matches nothing: the first UI edits landed in the history with no diff
 * at all beside a title that said something had changed.
 *
 * So a section's entry is described against the section's own columns, with the
 * prefix taken off whichever keys have one. One rendering for one kind of
 * change, whoever made it.
 *
 * ## And three that describe themselves better without one
 *
 * A **reorder** has nothing to say field by field; its title names the section
 * and its undo puts the order back, where a list of row ids would be true and
 * unreadable. **Hiding** and **showing** write only the tag pair that does it,
 * which is the mechanism rather than the change — "Hide this work experience"
 * is the whole of what happened. A **deletion** is the opposite: the row's
 * columns on the left and nothing on the right, which is the whole of "where
 * did that go".
 */
export function describeLoggedChange(entry: EditLogEntry): ProposedChange[] {
	const section = sectionOf(entry.capability);

	// A job or an application capability: not a section, so its own field list is
	// the only one there is.
	if (!section) {
		return entry.capability in CAPABILITIES
			? describeProposalChanges(entry.capability as Capability, entry.fields, entry.previous)
			: [];
	}

	const [verb, resource] = section;
	if (verb === 'reorder' || verb === 'hide' || verb === 'show') return [];

	return describeFieldChanges(
		Object.keys(PROFILE_RESOURCES[resource].fields),
		byColumn(entry.fields),
		byColumn(entry.previous)
	);
}

/** The verb and section of a profile action, or null for anything else. */
function sectionOf(action: string): [string, ProfileResourceName] | null {
	const at = action.indexOf('_');
	if (at === -1) return null;
	const resource = action.slice(at + 1);
	return resource in PROFILE_RESOURCES
		? [action.slice(0, at), resource as ProfileResourceName]
		: null;
}

/** `work_experience_project.outcome` -> `outcome`, and a column left alone. */
function byColumn(values: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(values).map(([key, value]) => [key.slice(key.indexOf('.') + 1), value])
	);
}

export async function readEditLog(
	profileId: number,
	limit = DEFAULT_LIMIT
): Promise<EditLogEntry[]> {
	const rows = await db
		.select()
		.from(capability_edits)
		.where(eq(capability_edits.profile_id, profileId))
		.orderBy(desc(capability_edits.date_created), desc(capability_edits.id))
		.limit(limit);

	return rows.map(toEntry);
}

export type RevertRefusal = 'not_found' | 'already_reverted' | 'not_revertible' | 'failed';

export type RevertOutcome = { ok: true } | { ok: false; reason: RevertRefusal; error: string };

/**
 * Put one logged change back.
 *
 * Scoped by profile in the same query that finds the row, so an id belonging to
 * someone else is indistinguishable from one that does not exist — the caller
 * learns nothing either way.
 */
export async function revertEdit(editId: number, actor: CapabilityActor): Promise<RevertOutcome> {
	const [row] = await db
		.select()
		.from(capability_edits)
		.where(and(eq(capability_edits.id, editId), eq(capability_edits.profile_id, actor.profileId)))
		.limit(1);

	if (!row) {
		return { ok: false, reason: 'not_found', error: 'That change is not in your history.' };
	}
	if (row.reverted_at) {
		return { ok: false, reason: 'already_reverted', error: 'That change was already undone.' };
	}

	const action = row.capability as LoggedAction;
	const capability = action in CAPABILITIES ? CAPABILITIES[action as Capability] : null;
	const revert = capability?.revert ?? (isUiAction(action) ? UI_ACTIONS[action].revert : undefined);

	if (!revert) {
		return {
			ok: false,
			reason: 'not_revertible',
			error: 'This kind of change cannot be undone from here.'
		};
	}

	// The capability's own authorize, against a fresh read — the same one the
	// write passed. A change made months ago is exactly the case where the row
	// has since been deleted or the profile switched.
	//
	// A UI action has none, and needs none: its target is a section rather than
	// a row it could read, and both of its reverts go through the write layer,
	// which scopes every statement to the actor's own profile. The check is the
	// write, one layer down, rather than a second one written here.
	if (capability && !(await capability.authorize(row.target, actor))) {
		return {
			ok: false,
			reason: 'not_found',
			error: 'You can no longer change what this edit changed.'
		};
	}

	try {
		await revert(row.target, row.previous, actor);
	} catch (e) {
		return {
			ok: false,
			reason: 'failed',
			error: e instanceof Error ? e.message : 'The change could not be undone.'
		};
	}

	// Conditional on still being un-reverted, so two clicks cannot both win and
	// write the before-image twice. The second finds nothing to update.
	const marked = await db
		.update(capability_edits)
		.set({ reverted_at: new Date() })
		.where(and(eq(capability_edits.id, editId), isNull(capability_edits.reverted_at)))
		.returning({ id: capability_edits.id });

	if (marked.length === 0) {
		return { ok: false, reason: 'already_reverted', error: 'That change was already undone.' };
	}

	return { ok: true };
}
