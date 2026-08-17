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
import { actorForRow, type ProfileActor, type WriteRefusal } from './write';
import type { ProfileResourceName } from './resources';

/**
 * Turn a write result into a value, or into the HTTP error the route would
 * otherwise have written by hand.
 *
 * `not_found` and `unauthorized` both come back as 403 "Access denied", which
 * is what these routes have always answered: a caller who does not own a row
 * learns nothing about whether it exists.
 */
export function unwrapWrite<T>(
	result: ({ ok: true } & T) | { ok: false; reason: WriteRefusal; error: string }
): { ok: true } & T {
	if (result.ok) return result;
	if (result.reason === 'invalid') {
		error(400, result.error);
	}
	error(403, 'Access denied');
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
