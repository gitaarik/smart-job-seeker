/**
 * May this account cause spend at all?
 *
 * Deliberately separate from "does it have budget". The two questions came
 * apart when an expired demo went on being scored for six weeks after nobody
 * could log into it: the credit gate passed, because the account still had
 * credits and because matching charges none in the first place. Budget is
 * `getBalance`; this is the account itself.
 *
 * Ask it where the work is DECIDED — the matcher cycle, the scrape scheduler,
 * `createAndGenerateAiChat` — rather than at the LLM call, which knows nothing
 * about accounts and is reached only after the expensive context assembly has
 * already been paid for.
 *
 * The predicate is one row and covers three cases with one rule, because all
 * three revoke access the same way:
 *   - an expired or revoked demo (the sweep sets `is_approved = false`),
 *   - an account an admin has not approved, or has un-approved,
 *   - an account with a pending erasure, whose access is revoked the moment
 *     `deletion_requested_at` is stamped (see `requireAuth`).
 *
 * The demo TEMPLATE is the one exemption and it is load-bearing. It is never a
 * login, so it is never approved, but `copyJobMatches` seeds every demo clone
 * from its matches: stop scoring it and each new mint re-scores the whole
 * corpus again, which is the ~11.6k-call bug this same investigation fixed.
 *
 * The failure direction that matters is a false block, which stops a real
 * user's matching silently. Callers log `reason`; nothing here fails open.
 */

import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export type SpendBlockReason = 'user_missing' | 'not_approved' | 'deletion_pending';

/** Discriminated so a caller cannot read `reason` without checking `allowed`. */
export type SpendEligibility = { allowed: true } | { allowed: false; reason: SpendBlockReason };

const REASON_TEXT: Record<SpendBlockReason, string> = {
	user_missing: 'owner account no longer exists',
	not_approved: 'account is not approved (expired demo, or awaiting approval)',
	deletion_pending: 'account has a pending erasure'
};

/** One line for a log or an error message. */
export function describeSpendBlock(reason: SpendBlockReason): string {
	return REASON_TEXT[reason];
}

/**
 * Whether this account may cause metered work to run.
 *
 * `user_missing` doubles as the orphan guard the matcher used to carry inline:
 * `profiles.user_id` has no FK to `users`, so a hard-deleted user leaves a
 * profile row behind, and `getBalance` upserts into `credit_balances` (which
 * DOES have that FK) and throws on it.
 */
export async function getSpendEligibility(userId: string): Promise<SpendEligibility> {
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { is_approved: true, is_demo_template: true, deletion_requested_at: true }
	});

	if (!user) return { allowed: false, reason: 'user_missing' };
	// Checked before approval, not after: the template is never approved.
	if (user.is_demo_template) return { allowed: true };
	if (!user.is_approved) return { allowed: false, reason: 'not_approved' };
	if (user.deletion_requested_at) return { allowed: false, reason: 'deletion_pending' };
	return { allowed: true };
}
