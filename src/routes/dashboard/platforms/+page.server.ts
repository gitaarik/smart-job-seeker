import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  // Get platforms where the user has credentials configured
  const platformProfiles = await db.platform_profiles.findMany({
    where: {
      profile: layoutData.selectedProfile.id,
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
    .filter((pp) => pp.job_platforms) // Ensure platform exists
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

  return {
    platforms,
  };
};
