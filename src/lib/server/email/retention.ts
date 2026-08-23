/**
 * Drop stored email past the retention window.
 *
 * Two tables keep whole messages and neither was ever pruned:
 *
 * - `inbound_emails` — every message relayed to a verification address, with
 *   `body_text`, `body_html`, the sender's address and any code or link parsed
 *   out of it. This is **third-party content**: the addresses and the bodies
 *   belong to platforms and people we have no relationship with.
 * - `sent_emails` — the fully rendered `html` of everything the product sends,
 *   which for verification, password-reset and demo-invite mail contains the
 *   live-at-the-time link. A leaked backup of this table is a leaked set of
 *   account-recovery URLs, so age alone is a reason to be rid of it.
 *
 * Both **delete outright** rather than tombstoning the body the way
 * ../ai-chats/retention.ts does. The reason `ai_chats` keeps its rows is that
 * they carry token and cost history the row is the only record of, and eight
 * FKs point at them. Neither is true here: nothing in the schema references
 * either table, and the only readers are `/admin/inbox` and `/admin/emails`,
 * which are triage surfaces for mail that has just been sent or has just
 * failed to arrive. A month-old delivery record answers no question the
 * provider's own dashboard doesn't answer better.
 *
 * The window is the account-erasure window (30 days), which is deliberate:
 * `planning/DATA-RETENTION.md` publishes one number for both, so an erasure
 * request and the mail that account generated stop existing on the same day.
 * Note account erasure already clears `sent_emails` for that user immediately —
 * this is the floor for everyone else, including mail sent to addresses that
 * never became an account.
 *
 * Deletion is NOT reversible. Idempotent — a repeat pass finds nothing.
 *
 * NOTE: like the prunes next door this reclaims space *for reuse by Postgres*;
 * the table file only shrinks on a rewrite. `scripts/prune-emails.ts --vacuum`
 * does that by hand during maintenance.
 */

import { inArray, lt } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { inbound_emails, sent_emails } from '$lib/server/db/schema';

export interface EmailRetentionResult {
	rowsDeleted: number;
	/** True when the batch limit was hit, so rows older than the window remain. */
	moreRemaining: boolean;
}

export interface EmailRetentionOptions {
	/** Rows older than this are deleted. */
	days: number;
	/**
	 * Cap on rows per pass, so a first run against a large backlog does not
	 * issue one enormous DELETE. The caller's schedule catches up over
	 * subsequent passes.
	 */
	limit?: number;
}

export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_BATCH_LIMIT = 20_000;

function cutoffFor(days: number): Date {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Delete relayed inbound messages older than the window.
 *
 * Status is deliberately not considered. A row still marked `received` is a
 * verification code nobody consumed, and a month-old one is not pending — it
 * is a code that expired within minutes of arriving.
 */
export async function pruneInboundEmails(
	opts: EmailRetentionOptions
): Promise<EmailRetentionResult> {
	const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
	const cutoff = cutoffFor(opts.days);

	// Select the batch by primary key first, then delete those ids. Postgres has
	// no DELETE ... LIMIT, and this keeps the row set stable and index-driven.
	const batch = await db
		.select({ id: inbound_emails.id })
		.from(inbound_emails)
		.where(lt(inbound_emails.received_at, cutoff))
		.limit(limit);

	if (batch.length === 0) return { rowsDeleted: 0, moreRemaining: false };

	const ids = batch.map((r) => r.id);
	const res = await db.delete(inbound_emails).where(inArray(inbound_emails.id, ids));

	return {
		rowsDeleted: res.rowCount ?? ids.length,
		moreRemaining: batch.length === limit
	};
}

/**
 * Delete sent-mail records older than the window.
 *
 * Failed sends are deleted on the same clock as successful ones. A delivery
 * failure is worth seeing while you can still do something about it; after a
 * month the address has either been fixed or the account never got off the
 * ground, and keeping the row keeps a recipient address nobody is using.
 */
export async function pruneSentEmails(opts: EmailRetentionOptions): Promise<EmailRetentionResult> {
	const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
	const cutoff = cutoffFor(opts.days);

	const batch = await db
		.select({ id: sent_emails.id })
		.from(sent_emails)
		.where(lt(sent_emails.sent_at, cutoff))
		.limit(limit);

	if (batch.length === 0) return { rowsDeleted: 0, moreRemaining: false };

	const ids = batch.map((r) => r.id);
	const res = await db.delete(sent_emails).where(inArray(sent_emails.id, ids));

	return {
		rowsDeleted: res.rowCount ?? ids.length,
		moreRemaining: batch.length === limit
	};
}
