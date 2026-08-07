/**
 * Credit guard stub — OSS version (always passes).
 * The cloud version overlays this with real credit checking.
 */

/** Check if user has enough credits — always passes in OSS. */
export async function requireCredits(_userId: string, _estimatedCost: number): Promise<void> {
	// No-op: everything is free in OSS
}
