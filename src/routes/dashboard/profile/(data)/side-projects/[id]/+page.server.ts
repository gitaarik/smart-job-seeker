import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, asc } from "drizzle-orm";
import { side_projects, side_project_achievements, side_project_technologies } from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/dashboard/profile/side-projects");
  }

  const project = await db.query.side_projects.findFirst({
    where: and(eq(side_projects.id, id), eq(side_projects.profile_id, layoutData.selectedProfile.id)),
    with: {
      side_project_achievements: {
        orderBy: asc(side_project_achievements.sort),
      },
      side_project_technologies: {
        orderBy: asc(side_project_technologies.sort),
      },
    },
  });

  if (!project) {
    redirect(302, "/dashboard/profile/side-projects");
  }

  // Get image URL
  const imageUrl = project?.image_path
    ? `/uploads/${project.image_path}`
    : null;

  // Get banner URL
  const bannerUrl = project?.banner_path
    ? `/uploads/${project.banner_path}`
    : null;

  return { project, imageUrl, bannerUrl };
};
