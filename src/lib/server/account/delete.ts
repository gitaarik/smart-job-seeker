/**
 * Account erasure — request, revoke, reap, restore.
 *
 * Until this existed there was no user-level delete at all: `/data/settings`
 * removed a single profile and refused if it was your last, `/data/delete` was
 * a 301 to that page, and nothing anywhere removed a `users` row. Honouring an
 * erasure request meant hand-written SQL.
 *
 * The shape follows `planning/DATA-RETENTION.md` §D1 and §D2:
 *
 * - **Hard delete, not anonymise** (D1). "We kept your data with the name filed
 *   off" is a much harder thing to defend than deletion. The one carve-out is
 *   payment history, which has a statutory retention of its own — those rows
 *   are kept with `user_id` nulled and an opaque `deleted_account_ref`.
 * - **A 30-day grace window** (D2). Access is revoked the moment the request is
 *   made; the row survives for 30 days. That is deliberately the same window as
 *   the nightly backups, so "gone from the database" and "gone from the
 *   backups" land on the same day and the promise can be stated without an
 *   asterisk.
 *
 * There is no self-service undo, and that follows from revoking access
 * immediately — someone who cannot sign in cannot click cancel. Restoring
 * inside the window is an admin action, which is also the right shape for the
 * case this protects against: a session that was not the account holder's
 * asking for the account to be destroyed.
 */

import { createHash } from 'node:crypto';
import { and, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	account_deletions,
	api_keys,
	billing_customers,
	credential_shares,
	credit_purchases,
	demo_links,
	device_shares,
	import_logs,
	mcp_keys,
	notifications,
	profiles,
	search_tasks,
	sent_emails,
	sessions,
	subscriptions,
	user_feedback,
	users
} from '$lib/server/db/schema';
import { deleteProfile } from '$lib/server/profile/delete';
import { collectUserFileRefs, reapFileRefs } from '$lib/server/uploads/reap';

/** Days between the request and the row actually going. See D2. */
export const DELETION_GRACE_DAYS = 30;

/**
 * The opaque reference that survives an account.
 *
 * A SHA-256 of the user id: enough to answer "was this account deleted, and
 * when" to someone who already holds the id, and nothing at all to someone who
 * does not. Storing the email instead would recreate the record the deletion
 * was supposed to destroy.
 */
export function accountRef(userId: string): string {
	return createHash('sha256').update(userId).digest('hex');
}

export interface DeletionRequest {
	requestedAt: Date;
	/** When the reaper will remove the row, absent an admin restore. */
	scheduledFor: Date;
}

/**
 * Ask for an account to be erased.
 *
 * Everything here is reversible by `cancelAccountDeletion` **except** the
 * credentials, which are revoked rather than paused. That asymmetry is
 * deliberate: a key that has been pointed at a deleted account should not come
 * back to life on a restore, and re-issuing one is a button. Sessions,
 * schedules and shares are the things a restored account needs back, and none
 * of them survive a revoke either — they are re-established by signing in.
 */
export async function requestAccountDeletion(
	userId: string,
	opts: { by?: 'user' | 'admin' } = {}
): Promise<DeletionRequest> {
	const requestedAt = new Date();

	await db.update(users).set({ deletion_requested_at: requestedAt }).where(eq(users.id, userId));

	// Force sign-out everywhere. The gate in hooks.server.ts is what stops a
	// fresh sign-in from simply minting another one.
	await db.delete(sessions).where(eq(sessions.userId, userId));

	// Kill the credentials that bypass the session gate entirely — device keys
	// and MCP keys authenticate on a bearer token and never reach `locals.user`.
	await db.update(api_keys).set({ revoked: true }).where(eq(api_keys.user_id, userId));
	await db.update(mcp_keys).set({ revoked: true }).where(eq(mcp_keys.user_id, userId));

	// Stop granting other people access to this account's devices and logins.
	await db.delete(device_shares).where(eq(device_shares.shared_with, userId));
	await db.delete(credential_shares).where(eq(credential_shares.shared_with, userId));
	await db
		.update(demo_links)
		.set({ status: 'revoked' })
		.where(and(eq(demo_links.created_by, userId), eq(demo_links.status, 'active')));

	// Nothing should keep scraping on behalf of an account that has asked to be
	// gone. `user_paused_at` is the column that means "hands off" to the
	// auto-import reconciler, which is exactly the intent here.
	await db
		.update(search_tasks)
		.set({ is_active: false, user_paused_at: requestedAt })
		.where(
			sql`${search_tasks.profile_id} IN (SELECT id FROM ${profiles} WHERE user_id = ${userId})`
		);

	const scheduledFor = new Date(requestedAt);
	scheduledFor.setDate(scheduledFor.getDate() + DELETION_GRACE_DAYS);

	console.log(
		`[account-delete] ${accountRef(userId).slice(0, 12)} requested by ${opts.by ?? 'user'}; reap at ${scheduledFor.toISOString()}`
	);

	return { requestedAt, scheduledFor };
}

/**
 * Undo a pending deletion, inside the window. Admin-only by construction — see
 * the module docstring for why there is no self-service path.
 *
 * Credentials revoked by the request stay revoked; everything else comes back
 * by signing in. Search tasks are deliberately **not** un-paused: the account
 * holder decides what starts running again, and a job search that resumes
 * itself on someone else's action is the surprise this avoids.
 */
export async function cancelAccountDeletion(userId: string): Promise<boolean> {
	const res = await db
		.update(users)
		.set({ deletion_requested_at: null })
		.where(and(eq(users.id, userId), isNotNull(users.deletion_requested_at)));
	return (res.rowCount ?? 0) > 0;
}

export interface ErasureResult {
	accountRef: string;
	profilesDeleted: number;
	filesDeleted: number;
	blobsUnlinked: number;
	mediaUnlinked: number;
	unlinkFailures: { path: string; error: string }[];
}

/**
 * Erase one account, for real.
 *
 * Order is load-bearing throughout:
 *
 * 1. Read the file references while the rows that name them still exist.
 * 2. Stamp the billing carve-out **before** the delete, because the FK sets
 *    `user_id` to null on the way out and the link would otherwise be gone.
 * 3. Clear the six tables that carry a `user_id` with no foreign key behind it
 *    — `DELETE FROM users` does not touch those, and nothing would say so.
 * 4. Delete profiles through `deleteProfile`, so per-profile bytes go too.
 * 5. Delete the user; the remaining 20 FKs cascade.
 * 6. Reap whatever files nothing references any more.
 * 7. Record that it happened, without recording who it happened to.
 */
export async function eraseAccount(
	userId: string,
	opts: { by?: 'user' | 'admin' } = {}
): Promise<ErasureResult> {
	const ref = accountRef(userId);

	const existing = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { id: true, deletion_requested_at: true }
	});
	if (!existing) throw new Error(`No such user: ${userId}`);

	const refs = await collectUserFileRefs(userId);

	// 2 — the payment carve-out (D1). Statutory retention outlives the right to
	// erasure, so these rows stay; the FK nulls `user_id` and this is what keeps
	// them reconcilable afterwards.
	await db
		.update(billing_customers)
		.set({ deleted_account_ref: ref })
		.where(eq(billing_customers.user_id, userId));
	await db
		.update(subscriptions)
		.set({ deleted_account_ref: ref })
		.where(eq(subscriptions.user_id, userId));
	await db
		.update(credit_purchases)
		.set({ deleted_account_ref: ref })
		.where(eq(credit_purchases.user_id, userId));

	// 3 — the tables a `DELETE FROM users` silently leaves behind. Each of these
	// carries a user_id with no FK, so nothing cascades and nothing complains.
	await db.delete(import_logs).where(eq(import_logs.user_id, userId));
	await db.delete(notifications).where(eq(notifications.user_id, userId));
	await db.delete(sent_emails).where(eq(sent_emails.user_id, userId));
	// user_feedback cascades to feedback_replies, user_feedback_subscribers and
	// user_feedback_files by FK; the file rows those pointed at are picked up by
	// the reap below.
	await db.delete(user_feedback).where(eq(user_feedback.user_id, userId));

	// 4 — profiles, one at a time, so each gets its own byte cleanup.
	const owned = await db.query.profiles.findMany({
		where: eq(profiles.user_id, userId),
		columns: { id: true }
	});
	for (const p of owned) {
		await deleteProfile(p.id);
	}

	// 5 — the account itself.
	await db.delete(users).where(eq(users.id, userId));

	// 6 — anything the per-profile passes could not claim (account-scoped
	// attachments, and files two records shared until one of them went).
	const reaped = await reapFileRefs(refs);

	// 7 — the proof, with no PII in it.
	await db
		.insert(account_deletions)
		.values({
			account_ref: ref,
			requested_at: existing.deletion_requested_at ?? new Date(),
			requested_by: opts.by ?? 'user',
			profiles_deleted: owned.length,
			files_deleted: reaped.filesDeleted,
			blobs_unlinked: reaped.blobsUnlinked,
			unlink_failures: reaped.failures.length
		})
		.onConflictDoNothing();

	if (reaped.failures.length > 0) {
		console.error(
			`[account-delete] ${ref.slice(0, 12)}: ${reaped.failures.length} file(s) survived the erasure`,
			reaped.failures
		);
	}

	return {
		accountRef: ref,
		profilesDeleted: owned.length,
		filesDeleted: reaped.filesDeleted,
		blobsUnlinked: reaped.blobsUnlinked,
		mediaUnlinked: reaped.mediaUnlinked,
		unlinkFailures: reaped.failures
	};
}

export interface ReapAccountsResult {
	due: number;
	erased: number;
	failed: { accountRef: string; error: string }[];
}

/**
 * The scheduled half: erase every account whose grace window has closed.
 *
 * One account failing must not stop the rest — an erasure that stalls behind
 * an unrelated error is an erasure that quietly does not happen.
 */
export async function reapDeletedAccounts(
	opts: { graceDays?: number; now?: Date } = {}
): Promise<ReapAccountsResult> {
	const graceDays = opts.graceDays ?? DELETION_GRACE_DAYS;
	const cutoff = new Date(opts.now ?? new Date());
	cutoff.setDate(cutoff.getDate() - graceDays);

	const due = await db.query.users.findMany({
		where: and(isNotNull(users.deletion_requested_at), lte(users.deletion_requested_at, cutoff)),
		columns: { id: true }
	});

	const result: ReapAccountsResult = { due: due.length, erased: 0, failed: [] };

	for (const u of due) {
		try {
			await eraseAccount(u.id);
			result.erased++;
		} catch (err) {
			result.failed.push({
				accountRef: accountRef(u.id),
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	return result;
}
