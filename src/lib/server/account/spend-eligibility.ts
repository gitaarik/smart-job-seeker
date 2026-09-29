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
 * Background callers (the matcher cycle and the scrape scheduler) also get the
 * idle rule: nobody has used the account for `IDLE_AFTER_DAYS`. On preview
 * (2026-09-29) four accounts left one to six months earlier were still matched
 * daily, which, since matching charges credits, spent their monthly allowance on
 * matches nobody saw, and one saved search had failed every day for a month on
 * a computer that was no longer connected. Nothing is lost by pausing: the next
 * visit stamps `last_seen_at` (see `last-seen.ts`), and the matcher then catches
 * up newest first. Work a person asks for never gets this rule: someone making
 * a request is using the account by definition, and an admin acting for them
 * should not be refused.
 *
 * The failure direction that matters is a false block, which stops a real
 * user's matching silently. Callers log `reason`; nothing here fails open.
 */

import { and, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles, users } from '$lib/server/db/schema';

export type SpendBlockReason = 'user_missing' | 'not_approved' | 'deletion_pending' | 'idle';

/** How long an account can go unused before background work stops for it. */
export const IDLE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Discriminated so a caller cannot read `reason` without checking `allowed`. */
export type SpendEligibility = { allowed: true } | { allowed: false; reason: SpendBlockReason };

const REASON_TEXT: Record<SpendBlockReason, string> = {
	user_missing: 'owner account no longer exists',
	not_approved: 'account is not approved (expired demo, or awaiting approval)',
	deletion_pending: 'account has a pending erasure',
	idle: `nobody has used the account for ${IDLE_AFTER_DAYS} days`
};

export interface SpendEligibilityOptions {
	/**
	 * The caller is work nobody asked for just now: the matcher cycle or the
	 * scrape scheduler. Adds the idle rule, which work a person asks for must
	 * never get.
	 */
	background?: boolean;
}

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
export async function getSpendEligibility(
	userId: string,
	options: SpendEligibilityOptions = {}
): Promise<SpendEligibility> {
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: {
			is_approved: true,
			is_demo_template: true,
			deletion_requested_at: true,
			last_seen_at: true,
			createdAt: true
		}
	});

	if (!user) return { allowed: false, reason: 'user_missing' };
	// Checked before approval and idleness, not after: the template is never
	// approved and never signs in.
	if (user.is_demo_template) return { allowed: true };
	if (!user.is_approved) return { allowed: false, reason: 'not_approved' };
	if (user.deletion_requested_at) return { allowed: false, reason: 'deletion_pending' };
	if (options.background && isIdle(user) && !(await hasDigestEnabled(userId))) {
		return { allowed: false, reason: 'idle' };
	}
	return { allowed: true };
}

/**
 * Whether nobody has used the account for `IDLE_AFTER_DAYS`. An account never
 * stamped is measured from its creation, so a new signup is not idle; one with
 * neither date is not idle either, because a false block is the failure that
 * matters here.
 */
function isIdle(user: { last_seen_at: Date | null; createdAt: Date | null }): boolean {
	const seen = user.last_seen_at ?? user.createdAt;
	if (!seen) return false;
	return Date.now() - seen.getTime() > IDLE_AFTER_DAYS * DAY_MS;
}

/**
 * A match digest counts as use. It is built from the matching the idle rule
 * would stop, and the applicant asked for it, so someone who reads their matches
 * by email without signing in keeps getting them until they switch it off.
 */
async function hasDigestEnabled(userId: string): Promise<boolean> {
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.user_id, userId), eq(profiles.email_digest_enabled, true)),
		columns: { id: true }
	});
	return profile !== undefined;
}
