/**
 * Deleting a profile, bytes included.
 *
 * The DB half has always worked — `profiles` cascades to everything under it.
 * The disk half never ran: uploads live under `uploads/` and no FK reaches a
 * filesystem, so every CV, certificate, logo and banner outlived the profile
 * that explained it.
 *
 * The ordering here is the whole trick, and it is why this is a function
 * rather than three lines at a call site: the file references can only be read
 * *before* the delete, and can only be safely acted on *after* it, because
 * "is anything still pointing at this file" is exactly the question the delete
 * changes the answer to.
 *
 * For a single file whose owner is known, use `deleteFile` in
 * `$lib/server/files` instead — this path exists for the bulk case where
 * ownership has to be established by reachability.
 */

import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { collectProfileFileRefs, reapFileRefs, type ReapResult } from '$lib/server/uploads/reap';

export interface DeleteProfileResult {
	profileId: number;
	reaped: ReapResult;
}

/**
 * Delete one profile and everything under it, including its uploaded bytes.
 *
 * Ownership is **not** checked here — the caller has already established it
 * (and has usually also enforced "not your last profile", which is a product
 * rule rather than a data one). This function is deliberately usable by the
 * account reaper, which has no notion of a last profile.
 */
export async function deleteProfile(profileId: number): Promise<DeleteProfileResult> {
	const refs = await collectProfileFileRefs(profileId);

	await db.delete(profiles).where(eq(profiles.id, profileId));

	const reaped = await reapFileRefs(refs);

	if (reaped.failures.length > 0) {
		// Loud, but not fatal: the rows are gone and the account holder's request
		// has been honoured in the database. A blob we could not unlink is an
		// operational problem to chase, not a reason to fail the request back to
		// someone who asked to be forgotten.
		console.error(
			`[profile-delete] profile ${profileId}: ${reaped.failures.length} file(s) could not be unlinked`,
			reaped.failures
		);
	}

	return { profileId, reaped };
}
