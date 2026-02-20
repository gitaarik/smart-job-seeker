import { error, redirect } from "@sveltejs/kit";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { incrementTokenVisit } from "$lib/server/auth/token-validation";
import { hashToken } from "$lib/server/auth/token-generator";
import { db } from "$lib/server/db";
import { DEFAULT_FORMAT, DEFAULT_VIEW_MODE } from "$lib/profile-tokens";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  params,
  getClientAddress,
}) => {
  const { slug, token: tokenString } = params;

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, {
      message: `Profile not found`,
    });
  }

  // Find the token
  const tokenHash = hashToken(tokenString);
  const token = await db.profile_tokens.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!token) {
    throw error(404, {
      message: "This link is not valid",
    });
  }

  if (token.status !== "published") {
    throw error(403, {
      message: "This link has been disabled",
    });
  }

  // Verify the token belongs to this profile
  const profileVersion = await db.profile_versions.findUnique({
    where: { id: token.profile_version },
    select: { profile: true },
  });

  if (!profileVersion || profileVersion.profile !== profile.id) {
    throw error(404, {
      message: "This link is not valid for this profile",
    });
  }

  if (token.expires_at && token.expires_at < new Date()) {
    throw error(403, {
      message: "This link has expired",
    });
  }

  if (
    token.visit_limit !== null &&
    token.visit_count >= token.visit_limit
  ) {
    throw error(403, {
      message: "This link has reached its view limit",
    });
  }

  // Determine format and view mode (defaults)
  const format = token.format || DEFAULT_FORMAT;
  const viewMode = token.view_mode || DEFAULT_VIEW_MODE;

  // If view_mode is PDF, redirect to the appropriate PDF route with token
  if (viewMode === "pdf") {
    const pdfPath = format === "cv" ? "cv.pdf" : "resume.pdf";
    redirect(302, `/p/${slug}/${pdfPath}?t=${tokenString}`);
  }

  // Increment visit counter (for HTML view - PDF view increments in its own route)
  await incrementTokenVisit(token.id, getClientAddress());

  return {
    profile: {
      ...profile,
      profile_versions: profile.profile_versions_profile_versions_profileToprofiles,
    },
    versionId: token.profile_version,
    format,
  };
};
