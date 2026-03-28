import { error } from "@sveltejs/kit";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import {
  checkProfileAccess,
  getVersionIdBySlug,
} from "$lib/server/profile/access-control";
import { incrementTokenVisit } from "$lib/server/auth/token-validation";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  params,
  url,
  locals,
  getClientAddress,
}) => {
  const { slug } = params;
  const token = url.searchParams.get("t");

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, {
      message: `Profile not found: ${slug}`,
    });
  }

  // Check access control
  const accessResult = await checkProfileAccess({
    profile,
    token,
    userId: locals.user?.id,
    clientIp: getClientAddress(),
    routeType: "resume",
  });

  if (!accessResult.allowed) {
    throw error(accessResult.statusCode, {
      message: accessResult.message,
    });
  }

  // Increment visit counter if token was used
  if (accessResult.accessType === "token" && accessResult.tokenId) {
    await incrementTokenVisit(accessResult.tokenId, getClientAddress());
  }

  // Resolve version: from access control, query param, or public version fallback
  let versionId = accessResult.versionId;
  if (!versionId && accessResult.accessType === "owner") {
    const versionSlug = url.searchParams.get("version");
    if (versionSlug) {
      versionId = await getVersionIdBySlug(profile.id, versionSlug) ??
        undefined;
    } else if (profile.public_resume_version) {
      // Fall back to public version when no specific version requested
      versionId = profile.public_resume_version;
    }
  }

  return {
    profile: {
      ...profile,
      profile_versions: profile
        .profile_versions_profile_versions_profileToprofiles,
    },
    versionId,
    accessType: accessResult.accessType,
  };
};
