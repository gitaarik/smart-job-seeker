/**
 * Delete expired sign-in sessions and verification tokens.
 *
 * better-auth writes a `sessions` row per sign-in (7-day lifetime, extended
 * daily while in use) and a `verifications` row per emailed code, invite or
 * reset link, and checks `expiresAt` on every read — but never deletes a row
 * that has expired. Measured on dev 2026-11-15: 3,002 expired sessions, each
 * with the IP address and user agent it was opened from. An expired row
 * answers no request and only keeps where someone signed in from.
 *
 * Both are deleted outright once they have been expired for `GRACE_DAYS`. The
 * grace is not policy, it is slack: a row that expired seconds ago may still
 * be mid-request, and a day is cheap. There is no retention knob here on
 * purpose — the lifetime is set where the session is configured
 * (`auth/better-auth.ts`), and this only clears what that lifetime already
 * ended.
 *
 * Deletion is NOT reversible. Idempotent — a repeat pass finds nothing.
 */

import { inArray, lt } from 'drizzle-orm';
import { dbDirect as db } from '#lib/server/db/index.ts';
import { sessions, verifications } from '#lib/server/db/schema.ts';

export interface AuthRetentionResult {
	rowsDeleted: number;
	/** True when the batch limit was hit, so expired rows remain. */
	moreRemaining: boolean;
}

export interface AuthRetentionOptions {
	/** Cap on rows per pass; the caller's schedule catches up. */
	limit?: number;
	/** Test seam. */
	now?: Date;
}

/** Days past `expiresAt` before a row is removed. */
export const GRACE_DAYS = 1;
export const DEFAULT_BATCH_LIMIT = 20_000;

function cutoffFor(now: Date): Date {
	return new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000);
}

export async function pruneExpiredSessions(
	opts: AuthRetentionOptions = {}
): Promise<AuthRetentionResult> {
	const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
	const cutoff = cutoffFor(opts.now ?? new Date());

	const batch = await db
		.select({ id: sessions.id })
		.from(sessions)
		.where(lt(sessions.expiresAt, cutoff))
		.limit(limit);

	if (batch.length === 0) return { rowsDeleted: 0, moreRemaining: false };

	const ids = batch.map((r) => r.id);
	const res = await db.delete(sessions).where(inArray(sessions.id, ids));

	return {
		rowsDeleted: res.rowCount ?? ids.length,
		moreRemaining: batch.length === limit
	};
}

export async function pruneExpiredVerifications(
	opts: AuthRetentionOptions = {}
): Promise<AuthRetentionResult> {
	const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
	const cutoff = cutoffFor(opts.now ?? new Date());

	const batch = await db
		.select({ id: verifications.id })
		.from(verifications)
		.where(lt(verifications.expiresAt, cutoff))
		.limit(limit);

	if (batch.length === 0) return { rowsDeleted: 0, moreRemaining: false };

	const ids = batch.map((r) => r.id);
	const res = await db.delete(verifications).where(inArray(verifications.id, ids));

	return {
		rowsDeleted: res.rowCount ?? ids.length,
		moreRemaining: batch.length === limit
	};
}
