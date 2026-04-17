import { db } from "$lib/server/db";
import { hashToken } from "./token-generator";

export interface TokenValidationResult {
  valid: boolean;
  profileVersionId?: number;
  error?: string;
  tokenId?: number;
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
): Promise<TokenValidationResult> {
  const tokenHash = hashToken(tokenString);

  const token = await db.profile_tokens.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!token) {
    return {
      valid: false,
      error: "Invalid or expired access token",
    };
  }

  if (token.status !== "published") {
    return {
      valid: false,
      error: "Access token is no longer valid",
    };
  }

  // Look up the profile_version to verify profile ownership
  const profileVersion = await db.profile_versions.findUnique({
    where: { id: token.profile_version },
    select: { profile_id: true },
  });

  if (!profileVersion || profileVersion.profile_id !== profileId) {
    return {
      valid: false,
      error: "Access token is not valid for this profile",
    };
  }

  if (token.expires_at && token.expires_at < new Date()) {
    return {
      valid: false,
      error: "Access token has expired",
    };
  }

  if (
    token.visit_limit !== null &&
    token.visit_count >= token.visit_limit
  ) {
    return {
      valid: false,
      error: "Access token visit limit exceeded",
    };
  }

  return {
    valid: true,
    profileVersionId: token.profile_version,
    tokenId: token.id,
  };
}

/**
 * Increment the visit counter for a token (atomic operation)
 * @param tokenId The token ID to increment
 * @param ipAddress Optional IP address to log
 */
export async function incrementTokenVisit(
  tokenId: number,
  ipAddress?: string,
): Promise<void> {
  await db.profile_tokens.update({
    where: { id: tokenId },
    data: {
      visit_count: { increment: 1 },
      last_accessed_at: new Date(),
      last_accessed_ip: ipAddress || null,
    },
  });
}
