import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { profiles, platform_profiles } from "$lib/server/db/schema";
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
  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, parseInt(profileId)),
      eq(profiles.user_id, user.id),
    ),
  });

  if (!profile) {
    throw error(403, "Not authorized");
  }

  // Get platforms where the user has credentials configured
  const platformProfiles = await db.query.platform_profiles.findMany({
    where: and(
      eq(platform_profiles.profile_id, profile.id),
      isNotNull(platform_profiles.username),
    ),
    columns: {
      id: true,
      username: true,
      status: true,
      last_login_at: true,
      login_error: true,
    },
    with: {
      job_platform: {
        columns: {
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
    .filter((pp) => pp.job_platform)
    .map((pp) => ({
      id: pp.job_platform!.id,
      name: pp.job_platform!.name,
      key: pp.job_platform!.key,
      url: pp.job_platform!.url,
      loginPageUrl: pp.job_platform!.login_page_url,
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
