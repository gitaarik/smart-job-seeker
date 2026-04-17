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
    redirect(302, "/dashboard/profile/side-projects");
  }

  const project = await db.side_projects.findFirst({
    where: { id, profile_id: layoutData.selectedProfile.id },
    include: {
      side_project_achievements: {
        orderBy: { sort: "asc" },
      },
      side_project_technologies: {
        orderBy: { sort: "asc" },
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
