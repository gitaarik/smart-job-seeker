import type { profiles } from "generated/prisma";
import { db } from "$lib/server/db";
import { validateToken } from "../auth/token-validation";

export interface AccessControlOptions {
  profile: profiles;
  token?: string | null;
  clientIp?: string;
  routeType: "cv" | "resume";
}

export interface AccessControlResult {
  allowed: boolean;
  statusCode: number;
  message: string;
  versionId?: number;
  tokenId?: number;
  accessType: "public" | "token";
}

/**
 * Check if a request has access to a profile's resume/CV
 * Access is granted in this order:
 * 1. Public version is set (no auth/token required)
 * 2. Valid token is provided
 * Otherwise, access is denied
 */
export async function checkProfileAccess(
  options: AccessControlOptions,
): Promise<AccessControlResult> {
  const { profile, token, routeType } = options;

  // 1. Check for public version access
  const publicVersionId = routeType === "cv"
    ? profile.public_cv_version
    : profile.public_resume_version;

  if (publicVersionId !== null && !token) {
    return {
      allowed: true,
      statusCode: 200,
      message: "Public access granted",
      versionId: publicVersionId,
      accessType: "public",
    };
  }

  // 2. Check for token access
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

  // 3. Deny access
  return {
    allowed: false,
    statusCode: 401,
    message: "This profile requires a valid access token",
    accessType: "public",
  };
}

/**
 * Get version name by version ID
 * @param versionId The profile version ID
 * @returns Version name or null if not found
 */
export async function getVersionNameById(
  versionId: number,
): Promise<string | null> {
  const version = await db.profile_versions.findUnique({
    where: { id: versionId },
    select: { name: true },
  });

  return version?.name || null;
}
