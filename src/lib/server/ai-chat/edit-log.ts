/**
 * What the capability registry has changed, and how to put it back.
 *
 * HTTP-free, like `executeCapability` and for the same reason: the page that
 * shows the feed is the only caller today and should not also be the only place
 * the rules are written down. An MCP server exposing "what have you changed?"
 * and "undo that" calls these.
 *
 * ## Recording is not optional, and it is not the caller's job
 *
 * `recordEdit` is called from inside `executeCapability`, after the write. Every
 * surface therefore logs by construction rather than by remembering to — which
 * is the property the whole table exists for, since the surface that most needs
 * logging is the one nobody is watching.
 *
 * It is also why a failure to log does not fail the write. The change already
 * happened; throwing here would report failure for something that succeeded, and
 * the caller would reasonably retry it. A missing log row is bad, and a
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
 * Not every capability has one. `add_*` deliberately does not: the row is on
 * its own page with a delete control, and giving the registry a delete is the
 * one thing the hide-not-delete design refused. The feed says where to go
 * instead, the same way the manifest names a page it cannot reach.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { capability_edits } from '$lib/server/db/schema';
import { CAPABILITIES, type Capability, type CapabilityActor } from './capabilities';

/**
 * Which surface made a write.
 *
 * `ui` is absent on purpose: form actions write through `profile/write.ts` and
 * never reach the registry, so a `ui` value would only ever be a claim nobody
 * makes. Add it when something actually routes a form through a capability.
 */
export type EditSource = 'chat' | 'mcp';

export interface EditLogEntry {
	id: number;
	capability: Capability;
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

export async function recordEdit(opts: {
	profileId: number;
	source: EditSource;
	capability: Capability;
	target: { id: number; label: string };
	fields: Record<string, unknown>;
	previous: Record<string, unknown>;
}): Promise<void> {
	await db.insert(capability_edits).values({
		profile_id: opts.profileId,
		source: opts.source,
		capability: opts.capability,
		target: opts.target,
		fields: opts.fields,
		previous: opts.previous
	});
}

function toEntry(row: typeof capability_edits.$inferSelect): EditLogEntry {
	const capability = row.capability as Capability;
	const def = CAPABILITIES[capability];

	return {
		id: row.id,
		capability,
		source: row.source as EditSource,
		target: row.target,
		fields: row.fields,
		previous: row.previous,
		revertedAt: row.reverted_at,
		createdAt: row.date_created,
		// A capability can be removed from the registry while its history stays —
		// `hide_language` was one for a day. The row still describes what happened;
		// it just cannot be named or undone.
		title: def?.title ?? capability,
		revertible: !!def?.revert && !row.reverted_at
	};
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

	const def = CAPABILITIES[row.capability as Capability];
	if (!def?.revert) {
		return {
			ok: false,
			reason: 'not_revertible',
			error: 'This kind of change cannot be undone from here.'
		};
	}

	// The capability's own authorize, against a fresh read — the same one the
	// write passed. A change made months ago is exactly the case where the row
	// has since been deleted or the profile switched.
	if (!(await def.authorize(row.target, actor))) {
		return {
			ok: false,
			reason: 'not_found',
			error: 'You can no longer change what this edit changed.'
		};
	}

	try {
		await def.revert(row.target, row.previous, actor);
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
