import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";

/**
 * GET /api/platforms
 *
 * Get platforms where the user has credentials configured.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  const profileId = url.searchParams.get("profileId");
  if (!profileId) {
    throw error(400, "Profile ID required");
  }

  // Verify user owns this profile
  const profile = await db.profiles.findFirst({
    where: {
      id: parseInt(profileId),
      user_id: user.id,
    },
  });

  if (!profile) {
    throw error(403, "Not authorized");
  }

  // Get platforms where the user has credentials configured
  const platformProfiles = await db.platform_profiles.findMany({
    where: {
      profile: profile.id,
      username: { not: null },
    },
    select: {
      id: true,
      username: true,
      status: true,
      last_login_at: true,
      login_error: true,
      job_platforms: {
        select: {
          id: true,
          name: true,
          key: true,
          url: true,
          login_page_url: true,
        },
      },
    },
  });

  // Transform to the expected structure
  const platforms = platformProfiles
    .filter((pp) => pp.job_platforms)
    .map((pp) => ({
      id: pp.job_platforms!.id,
      name: pp.job_platforms!.name,
      key: pp.job_platforms!.key,
      url: pp.job_platforms!.url,
      loginPageUrl: pp.job_platforms!.login_page_url,
      hasCredentials: true,
      credentials: {
        id: pp.id,
        username: pp.username,
        status: pp.status,
        last_login_at: pp.last_login_at?.toISOString() || null,
        login_error: pp.login_error,
      },
    }));

  return json(platforms);
};
