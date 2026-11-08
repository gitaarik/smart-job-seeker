/**
 * Media library storage-quota guard stub: OSS version (always passes).
 * The cloud version overlays this with per-plan enforcement of
 * `maxMediaBytes` from PLAN_LIMITS. See planning/MEDIA-LIBRARY.md, open
 * question 1: originals get a budget of their own rather than counting
 * against the document cap, which measures extracted text.
 *
 * `createMediaItem` calls it inside a transaction that holds a per-account
 * lock, and passes that transaction as `executor`, so the usage the overlay
 * reads and the item about to be inserted cannot race another upload.
 */
import type { dbDirect } from '$lib/server/db';

/** What the check reads through: the database, or the caller's transaction. */
export type MediaQuotaExecutor = Pick<typeof dbDirect, 'select'>;

/**
 * Ensure storing this original won't exceed the user's plan media quota.
 * @param incomingBytes the stored size of the original about to be added
 */
export async function requireMediaQuota(
	_userId: string,
	_incomingBytes: number,
	_executor?: MediaQuotaExecutor
): Promise<void> {
	// No-op: unlimited in OSS.
}
