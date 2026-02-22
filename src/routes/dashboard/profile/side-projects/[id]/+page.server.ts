import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../utils";
import { deleteEntityMedia } from "$lib/server/uploads/entity-media";

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
    where: { id, profile: layoutData.selectedProfile.id },
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

export const actions: Actions = {
  update: async ({ request, params, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return fail(400, { error: "Invalid project ID" });
    }

    // Verify ownership
    const existing = await db.side_projects.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Project not found" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const url = formData.get("url") as string;
    const url_label = formData.get("url_label") as string;
    const summary = formData.get("summary") as string;
    const stars = formData.get("stars") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;
    const achievementsJson = formData.get("achievements") as string;
    const technologiesJson = formData.get("technologies") as string;
    const deleteImagePath = formData.get("delete_image_path") as string;
    const deleteBannerPath = formData.get("delete_banner_path") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Project name is required" });
    }

    // Handle image deletion if marked
    if (deleteImagePath === "true") {
      await deleteEntityMedia("side_project", id, "image_path");
    }

    // Handle banner deletion if marked
    if (deleteBannerPath === "true") {
      await deleteEntityMedia("side_project", id, "banner_path");
    }

    // Update main project
    await db.side_projects.update({
      where: { id },
      data: {
        name: name.trim(),
        url: url?.trim() || null,
        url_label: url_label?.trim() || null,
        summary: summary?.trim() || null,
        stars: stars ? parseInt(stars) : null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        date_updated: new Date(),
      },
    });

    // Update achievements if provided
    if (achievementsJson) {
      const achievements: string[] = JSON.parse(achievementsJson);

      // Delete existing achievements
      await db.side_project_achievements.deleteMany({
        where: { side_project: id },
      });

      // Create new achievements
      for (let i = 0; i < achievements.length; i++) {
        const desc = achievements[i].trim();
        if (desc) {
          await db.side_project_achievements.create({
            data: {
              description: desc,
              side_project: id,
              sort: i,
              date_created: new Date(),
            },
          });
        }
      }
    }

    // Update technologies if provided
    if (technologiesJson) {
      const technologies: string[] = JSON.parse(technologiesJson);

      // Delete existing technologies
      await db.side_project_technologies.deleteMany({
        where: { side_project: id },
      });

      // Create new technologies
      for (let i = 0; i < technologies.length; i++) {
        const techName = technologies[i].trim();
        if (techName) {
          await db.side_project_technologies.create({
            data: {
              name: techName,
              side_project: id,
              sort: i,
              date_created: new Date(),
            },
          });
        }
      }
    }

    return { success: true };
  },
};
