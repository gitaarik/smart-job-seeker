/**
 * Document storage-quota guard stub — OSS version (always passes).
 * The cloud version overlays this with real per-plan enforcement
 * (`maxDocumentProjects` / `maxDocumentBytes` from PLAN_LIMITS).
 * See planning/DOCUMENT-INGESTION.md § "Billing & limits".
 */

/**
 * Ensure this upload won't exceed the user's plan storage quota.
 * @param incomingBytes total extracted-text bytes this upload would add
 * @param incomingProjects number of new document projects this upload creates
 */
export async function requireDocumentQuota(
	_userId: string,
	_incomingBytes: number,
	_incomingProjects: number
): Promise<void> {
	// No-op: unlimited in OSS.
}
