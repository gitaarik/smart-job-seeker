/**
 * Profile-count guard stub — OSS version (always passes).
 * The cloud version overlays this with real per-plan enforcement
 * (`profiles` from PLAN_LIMITS). A self-hosted install has no plans to
 * enforce, so it can create as many profiles as it likes.
 */

/**
 * Ensure creating `incomingProfiles` more profiles stays within the user's plan.
 * Throws a 403 `HttpError` when it would not.
 */
export async function requireProfileQuota(
	_userId: string,
	_incomingProfiles: number = 1
): Promise<void> {
	// No-op: unlimited in OSS.
}
