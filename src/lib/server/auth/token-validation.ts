import { db } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import { profile_tokens, profile_versions } from '$lib/server/db/schema';
import { hashToken } from './token-generator';

export interface TokenValidationResult {
	valid: boolean;
	profileVersionId?: number;
	error?: string;
	tokenId?: number;
	/** What the link opens: `resume`, `cv` or `portfolio` (see $lib/profile-tokens). */
	format?: string;
	/** When the link stops working, if it ever does. */
	expiresAt?: Date | null;
}

export interface TokenValidationOptions {
	/**
	 * Refuse a link that has been opened as often as its limit allows. On by
	 * default. Off for the portfolio's key (server/profile/portfolio-key.ts):
	 * the limit counts how often the link is opened, and a visitor who opened
	 * it once holds the key from then on, so a link limited to one visit would
	 * otherwise lock its visitor out on the page it had just let them into.
	 */
	visitLimit?: boolean;
}

/**
 * Validate a token and return the profile version it grants access to
 * @param tokenString The token string from the URL
 * @param profileId The profile ID to validate against
 * @returns Validation result with version ID if valid
 */
export async function validateToken(
	tokenString: string,
	profileId: number,
	{ visitLimit = true }: TokenValidationOptions = {}
): Promise<TokenValidationResult> {
	const tokenHash = hashToken(tokenString);

	const token = await db.query.profile_tokens.findFirst({
		where: eq(profile_tokens.token_hash, tokenHash)
	});

	if (!token) {
		return {
			valid: false,
			error: 'Invalid or expired access token'
		};
	}

	if (token.status !== 'published') {
		return {
			valid: false,
			error: 'Access token is no longer valid'
		};
	}

	// Look up the profile_version to verify profile ownership
	const profileVersion = await db.query.profile_versions.findFirst({
		where: eq(profile_versions.id, token.profile_version),
		columns: { profile_id: true }
	});

	if (!profileVersion || profileVersion.profile_id !== profileId) {
		return {
			valid: false,
			error: 'Access token is not valid for this profile'
		};
	}

	if (token.expires_at && token.expires_at < new Date()) {
		return {
			valid: false,
			error: 'Access token has expired'
		};
	}

	if (visitLimit && token.visit_limit !== null && token.visit_count >= token.visit_limit) {
		return {
			valid: false,
			error: 'Access token visit limit exceeded'
		};
	}

	return {
		valid: true,
		profileVersionId: token.profile_version,
		tokenId: token.id,
		format: token.format,
		expiresAt: token.expires_at
	};
}

/**
 * Record that a link's holder came back, without counting a visit: when and
 * from where, as the share links page shows it. For the portfolio's key, whose
 * visits are counted once, when the link itself is opened.
 */
export async function touchTokenVisit(tokenId: number, ipAddress?: string): Promise<void> {
	await db
		.update(profile_tokens)
		.set({ last_accessed_at: new Date(), last_accessed_ip: ipAddress || null })
		.where(eq(profile_tokens.id, tokenId));
}

/**
 * Increment the visit counter for a token (atomic operation)
 * @param tokenId The token ID to increment
 * @param ipAddress Optional IP address to log
 */
export async function incrementTokenVisit(tokenId: number, ipAddress?: string): Promise<void> {
	await db
		.update(profile_tokens)
		.set({
			visit_count: sql`${profile_tokens.visit_count} + 1`,
			last_accessed_at: new Date(),
			last_accessed_ip: ipAddress || null
		})
		.where(eq(profile_tokens.id, tokenId));
}
