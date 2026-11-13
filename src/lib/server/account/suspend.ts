/**
 * Suspend an account: shut it out, keep everything.
 *
 * For abuse, a payment dispute or a login that looks compromised, where
 * deleting would destroy what the account holder (or a dispute) still needs.
 * Access goes the way an erasure request takes it (`revokeAccess`), and the
 * auth gates refuse a suspended account until an admin lifts it.
 *
 * Lifting it does not hand back what was revoked. The person signs in again,
 * issues new device and MCP keys, and restarts their own searches; shares
 * from other people are theirs to grant again. That matches
 * `cancelAccountDeletion`, for the same reason: a key that was cut off for
 * cause should not come back to life on someone else's click.
 */

import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { revokeAccess } from './delete';

/**
 * Returns false when the account does not exist or is already suspended, so
 * a second click neither moves the date nor revokes anything twice.
 */
export async function suspendAccount(userId: string, reason: string): Promise<boolean> {
	const at = new Date();
	const res = await db
		.update(users)
		.set({ suspended_at: at, suspended_reason: reason.trim() || null })
		.where(and(eq(users.id, userId), isNull(users.suspended_at)));
	if ((res.rowCount ?? 0) === 0) return false;

	await revokeAccess(userId, at);
	console.log(`[account-suspend] user ${userId} suspended`);
	return true;
}

/** Returns false when the account was not suspended. */
export async function unsuspendAccount(userId: string): Promise<boolean> {
	const res = await db
		.update(users)
		.set({ suspended_at: null, suspended_reason: null })
		.where(and(eq(users.id, userId), isNotNull(users.suspended_at)));
	const lifted = (res.rowCount ?? 0) > 0;
	if (lifted) console.log(`[account-suspend] user ${userId} unsuspended`);
	return lifted;
}
