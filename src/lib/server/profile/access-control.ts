import type { Profiles } from "$lib/server/db/schema";
import { db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { profile_versions } from "$lib/server/db/schema";
import { validateToken } from "../auth/token-validation";

export interface AccessControlOptions {
  profile: profiles;
  token?: string | null;
  userId?: string | null;
  clientIp?: string;
  routeType: "cv" | "resume";
}

export interface AccessControlResult {
  allowed: boolean;
  statusCode: number;
  message: string;
  versionId?: number;
  tokenId?: number;
  accessType: "public" | "token" | "owner";
}

/**
 * Check if a request has access to a profile's resume/CV
 * Access is granted in this order:
 * 1. Public version is set (no auth/token required)
 * 2. Logged-in user owns the profile
 * 3. Valid token is provided
 * Otherwise, access is denied
 */
export async function checkProfileAccess(
  options: AccessControlOptions,
): Promise<AccessControlResult> {
  const { profile, token, userId, routeType } = options;

  // 1. Check for public version access
  const publicVersionId = routeType === "cv"
    ? profile.public_cv_version_id
    : profile.public_resume_version_id;

  if (publicVersionId !== null && !token) {
    return {
      allowed: true,
      statusCode: 200,
      message: "Public access granted",
      versionId: publicVersionId,
      accessType: "public",
    };
  }

  // 2. Check if logged-in user owns this profile
  if (userId && profile.user_id === userId) {
    return {
      allowed: true,
      statusCode: 200,
      message: "Owner access granted",
      accessType: "owner",
    };
  }

  // 3. Check for token access
  if (token) {
    const validationResult = await validateToken(token, profile.id);

    if (validationResult.valid) {
      return {
        allowed: true,
        statusCode: 200,
        message: "Token access granted",
        versionId: validationResult.profileVersionId,
        tokenId: validationResult.tokenId,
        accessType: "token",
      };
    }

    return {
      allowed: false,
      statusCode: 401,
      message: validationResult.error ||
        "Invalid or expired access token",
      accessType: "token",
    };
  }

  // 4. Deny access
  return {
    allowed: false,
    statusCode: 401,
    message: "This profile requires a valid access token",
    accessType: "public",
  };
}

/**
 * Get version slug by version ID
 * @param versionId The profile version ID
 * @returns Version slug or null if not found
 */
export async function getVersionSlugById(
  versionId: number,
): Promise<string | null> {
  const version = await db.query.profile_versions.findFirst({
    where: eq(profile_versions.id, versionId),
    columns: { slug: true },
  });

  return version?.slug || null;
}

/**
 * Get version ID by slug and profile
 */
export async function getVersionIdBySlug(
  profileId: number,
  versionSlug: string,
): Promise<number | null> {
  const version = await db.query.profile_versions.findFirst({
    where: and(eq(profile_versions.profile_id, profileId), eq(profile_versions.slug, versionSlug)),
    columns: { id: true },
  });

  return version?.id ?? null;
}
