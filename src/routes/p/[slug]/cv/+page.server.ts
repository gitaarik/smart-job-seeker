import { error } from "@sveltejs/kit";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { checkProfileAccess } from "$lib/server/profile/access-control";
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
    user: locals.user,
    token,
    clientIp: getClientAddress(),
    routeType: "cv",
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

  return {
    profile,
    versionId: accessResult.versionId,
    accessType: accessResult.accessType,
  };
};
