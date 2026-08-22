/**
 * The REST half of the write layer's refusal mapping.
 *
 * `write.ts` is deliberately HTTP-free — it says *why* it refused and leaves the
 * status code to whoever asked, because a form action and a REST route disagree
 * about what a missing row should say. This is the route side of that, in one
 * place so the four endpoints cannot drift on it.
 *
 * It lives here rather than in `api-helpers.ts` on purpose: that module is
 * imported by most routes in the tree for `requireAuth` alone, and putting a
 * profile-write import in it drags the whole resource declaration — and with it
 * every table in the schema — into modules that wanted one function.
 */

import { error } from '@sveltejs/kit';
import { actorForRow, updateRow, type ProfileActor, type WriteRefusal } from './write';
import type { ProfileResourceName } from './resources';

/**
 * Turn a write result into a value, or into the HTTP error the route would
 * otherwise have written by hand.
 *
 * `not_found` and `unauthorized` both come back as 403 "Access denied", which
 * is what these routes have always answered: a caller who does not own a row
 * learns nothing about whether it exists.
 *
 * `conflict` is a 409 carrying its own message, because it is the one refusal
 * here the user can act on: the row moved, and the answer is to reload. A 400
 * would read as "your input is malformed", which is the opposite of true — the
 * input was fine when the page was drawn.
 */
export function unwrapWrite<T>(
	result: ({ ok: true } & T) | { ok: false; reason: WriteRefusal; error: string }
): { ok: true } & T {
	if (result.ok) return result;
	if (result.reason === 'invalid') {
		error(400, result.error);
	}
	if (result.reason === 'conflict') {
		error(409, result.error);
	}
	error(403, 'Access denied');
}

/**
 * Split a PATCH body into the patch and the baseline it claims to be editing.
 *
 * Bodies without a baseline are unchanged, which is what keeps every caller that
 * has nothing to be stale about working.
 */
function splitExpected(body: Record<string, unknown>): {
	patch: Record<string, unknown>;
	expected?: Record<string, unknown>;
} {
	const { expected, ...patch } = body;
	return expected && typeof expected === 'object' && !Array.isArray(expected)
		? { patch, expected: expected as Record<string, unknown> }
		: { patch };
}

/**
 * PATCH one row this actor owns, honouring the baseline the body carries.
 *
 * Every HTTP door onto `updateRow` goes through here, and that is the point:
 * the conditional write is not something a door remembers to do, it is what a
 * door *is*. Before this the doors each spelled out the same three steps, which
 * is exactly the shape where the fourth one quietly omits the middle step and
 * nothing fails — it just silently overwrites again.
 *
 * ## Why the baseline is required here and optional in `updateRow`
 *
 * `updateRow` treats an absent baseline as "this caller has nothing to be stale
 * about", which is true of a capability write and false of a browser. Left
 * optional at the door too, the guard protects only the clients that opted in —
 * and the client that most needs it is the one that cannot, because a tab
 * loaded before the change shipped is running the bundle that does not send it.
 *
 * That is not a thought experiment. It is how a restored value was reverted a
 * third time, ninety seconds after the guard went in and by the same open tab
 * the guard was written for: the server was ready, the tab was not, and a
 * missing baseline read as consent.
 *
 * So the door refuses instead. It costs the capability paths nothing — they
 * call `updateRow` directly and never come through here — and it turns a stale
 * bundle from a silent revert into a message telling the user to reload.
 *
 * Throws the HTTP error on refusal, like `unwrapWrite`, so a route stays the
 * one line it should be.
 */
export async function patchOwnedRow(
	resource: ProfileResourceName,
	actor: ProfileActor,
	id: number,
	body: Record<string, unknown>
): Promise<void> {
	const { patch, expected } = splitExpected(body);
	if (!expected) {
		error(
			400,
			'This page was loaded before an update and can no longer save safely. ' +
				'Reload the page and try again.'
		);
	}
	unwrapWrite(await updateRow(resource, actor, id, patch, { expected }));
}

/**
 * The actor for a row the signed-in user claims to own, or 403.
 *
 * Ownership is a profile question and these routes authenticate a user, so the
 * translation happens once here rather than four times inline. A row that does
 * not exist and a row belonging to someone else give the same answer on
 * purpose.
 */
export async function requireRowActor(
	resource: ProfileResourceName,
	id: number,
	userId: string
): Promise<ProfileActor> {
	const actor = await actorForRow(resource, id, userId);
	if (!actor) {
		error(403, 'Access denied');
	}
	// Everything through here is a person at a keyboard — an autosaving editor or
	// a form — so it belongs in the change history. See ProfileActor.
	return { ...actor, source: 'ui' };
}
