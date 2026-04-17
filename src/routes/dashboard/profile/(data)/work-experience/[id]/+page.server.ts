import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/dashboard/profile/work-experience");
  }

  const experience = await db.work_experiences.findFirst({
    where: { id, profile_id: layoutData.selectedProfile.id },
    include: {
      work_experience_achievements: {
        orderBy: { sort: "asc" },
      },
      work_experience_technologies: {
        orderBy: { sort: "asc" },
      },
    },
  });

  // Get logo URL (prefer local path, fall back to Directus UUID)
  const logoUrl = experience?.logo_path
    ? `/uploads/${experience.logo_path}`
    : experience?.logo_id
      ? `/assets/${experience.logo_id}`
      : null;

  // Get banner URL
  const bannerUrl = experience?.banner_path
    ? `/uploads/${experience.banner_path}`
    : null;

  if (!experience) {
    redirect(302, "/dashboard/profile/work-experience");
  }

  return { experience, logoUrl, bannerUrl };
};
