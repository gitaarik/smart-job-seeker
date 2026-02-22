import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../utils";
import { deleteEntityMedia } from "$lib/server/uploads/entity-media";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const projects = await db.side_projects.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
    include: {
      side_project_achievements: {
        orderBy: { sort: "asc" },
      },
      side_project_technologies: {
        orderBy: { sort: "asc" },
      },
    },
  });

  return { projects, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const url = formData.get("url") as string;
    const url_label = formData.get("url_label") as string;
    const summary = formData.get("summary") as string;
    const stars = formData.get("stars") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Project name is required" });
    }

    // Get the highest sort value
    const lastItem = await db.side_projects.findFirst({
      where: { profile: profileId },
      orderBy: { sort: "desc" },
    });

    await db.side_projects.create({
      data: {
        name: name.trim(),
        url: url?.trim() || null,
        url_label: url_label?.trim() || null,
        summary: summary?.trim() || null,
        stars: stars ? parseInt(stars) : null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        profile: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        date_created: new Date(),
      },
    });

    return { success: true };
  },

  update: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
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

    if (isNaN(id)) {
      return fail(400, { error: "Invalid project ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Project name is required" });
    }

    // Verify ownership
    const existing = await db.side_projects.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Project not found" });
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

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);

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

    // Delete will cascade to achievements and technologies
    await db.side_projects.delete({
      where: { id },
    });

    return { success: true };
  },
};
