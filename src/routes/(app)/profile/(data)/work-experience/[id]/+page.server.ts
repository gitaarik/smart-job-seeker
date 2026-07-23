import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq } from "drizzle-orm";
import {
  work_experience_achievements,
  work_experience_project_technologies,
  work_experience_projects,
  work_experience_technologies,
  work_experiences,
} from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/profile/work-experience");
  }

  const experience = await db.query.work_experiences.findFirst({
    where: and(
      eq(work_experiences.id, id),
      eq(work_experiences.profile_id, layoutData.selectedProfile.id),
    ),
    with: {
      work_experience_achievements: {
        orderBy: asc(work_experience_achievements.sort),
      },
      work_experience_technologies: {
        orderBy: asc(work_experience_technologies.sort),
      },
      work_experience_projects: {
        orderBy: asc(work_experience_projects.sort),
        with: {
          work_experience_project_technologies: {
            orderBy: asc(work_experience_project_technologies.sort),
          },
        },
      },
    },
  });

  // Get logo URL (prefer local path, fall back to file UUID)
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
    redirect(302, "/profile/work-experience");
  }

  return { experience, logoUrl, bannerUrl };
};
