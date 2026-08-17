/**
 * The write side of the change log, and the only part of it a writer needs.
 *
 * ## Why this is not in `edit-log.ts`
 *
 * That file resolves a logged change back to the capability that made it, so it
 * imports the capability registry — which imports the generated profile
 * capabilities, which import `write.ts`. Recording from `write.ts` through it
 * would close that circle. Nothing here knows what a capability is: it is a row
 * describing something that happened, and the reading side is where the
 * meaning gets attached.
 *
 * ## What "logs by construction" means here
 *
 * The table used to hold what the assistant and MCP had changed, and said so:
 * a `ui` source would have been "a claim nobody makes", because form actions
 * went through `write.ts` and never reached the registry. They still don't. The
 * difference is that `write.ts` now records for itself, so a change made by a
 * person at a keyboard lands in the same history as one made by an agent —
 * which is what turns the page from an account of what the assistant did into
 * an account of what happened.
 *
 * Recording is per WRITE, not per door. There are three doors (the form-action
 * factory, `requireRowActor`, and the section endpoint's profile check) and
 * each sets `source` on the actor it resolves; a fourth would have to opt in,
 * which is the one part of this that is a convention rather than a guarantee.
 * What is guaranteed is the shape: every write that logs, logs the same way,
 * with a before-image taken inside the same call that overwrites it.
 *
 * ## And why a failed log does not fail the write
 *
 * Unchanged from when this lived next door, and worth restating where the
 * callers are. The change already happened. Throwing here would report failure
 * for something that succeeded and invite a retry, and a missing history row is
 * a great deal better than a doubly-applied edit.
 */

import { dbDirect as db } from '$lib/server/db';
import { capability_edits } from '$lib/server/db/schema';

/**
 * Which surface made a write.
 *
 * `ui` covers every door a person comes through — a form action, a REST patch
 * from an auto-saving editor — because what the history is asked is "did I do
 * this or did something else", and the answer does not get more useful by
 * naming which of their own forms it was.
 */
export type EditSource = 'chat' | 'mcp' | 'ui';

export interface RecordedChange {
	profileId: number;
	source: EditSource;
	/**
	 * What happened, as a capability name (`edit_work_experience`) or one of the
	 * UI-only actions beside them (`delete_…`, `reorder_…`, `show_…`). The
	 * reading side resolves it to a title and, where there is one, an undo.
	 */
	action: string;
	target: { id: number; label: string };
	fields: Record<string, unknown>;
	previous: Record<string, unknown>;
}

/**
 * Returns the new row's id, which is the handle an undo is addressed by.
 *
 * It matters most where nobody is watching: an MCP tool result carries it back
 * so the agent can tell the applicant how to reverse what it just did, in the
 * transcript they are actually reading, rather than leaving them to find the
 * change in a feed they may not know exists.
 */
export async function recordChange(change: RecordedChange): Promise<number> {
	const [row] = await db
		.insert(capability_edits)
		.values({
			profile_id: change.profileId,
			source: change.source,
			capability: change.action,
			target: change.target,
			fields: change.fields,
			previous: change.previous
		})
		.returning({ id: capability_edits.id });

	return row.id;
}

/**
 * Record without letting a logging failure become a write failure.
 *
 * For the callers inside `write.ts`, which have already written by the time
 * they get here. `recordChange` itself still throws, because
 * `executeCapability` wants to know: it logs before returning to a caller that
 * has not yet reported success.
 */
export async function recordChangeQuietly(change: RecordedChange): Promise<void> {
	try {
		await recordChange(change);
	} catch (e) {
		console.error('[change-log] could not record a change:', e);
	}
}
