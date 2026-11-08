/**
 * Media library storage-quota guard stub: OSS version (always passes).
 * The cloud version overlays this with per-plan enforcement of
 * `maxMediaBytes` from PLAN_LIMITS. See planning/MEDIA-LIBRARY.md, open
 * question 1: originals get a budget of their own rather than counting
 * against the document cap, which measures extracted text.
 */

/**
 * Ensure storing this original won't exceed the user's plan media quota.
 * @param incomingBytes the size of the upload about to be stored
 */
export async function requireMediaQuota(_userId: string, _incomingBytes: number): Promise<void> {
	// No-op: unlimited in OSS.
}
