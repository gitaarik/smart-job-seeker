import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../utils";
import { deleteEntityMedia } from "$lib/server/uploads/entity-media";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/dashboard/profile/work-experience");
  }

  const experience = await db.work_experiences.findFirst({
    where: { id, profile: layoutData.selectedProfile.id },
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
    : experience?.logo
      ? `/assets/${experience.logo}`
      : null;

  if (!experience) {
    redirect(302, "/dashboard/profile/work-experience");
  }

  return { experience, logoUrl };
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
      return fail(400, { error: "Invalid experience ID" });
    }

    // Verify ownership
    const existing = await db.work_experiences.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Experience not found" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const position = formData.get("position") as string;
    const location = formData.get("location") as string;
    const website = formData.get("website") as string;
    const description = formData.get("description") as string;
    const summary = formData.get("summary") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;
    const achievementsJson = formData.get("achievements") as string;
    const technologiesJson = formData.get("technologies") as string;
    const deleteLogoPath = formData.get("delete_logo_path") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Company name is required" });
    }

    if (!position || position.trim().length === 0) {
      return fail(400, { error: "Position is required" });
    }

    // Handle logo deletion if marked
    if (deleteLogoPath === "true") {
      await deleteEntityMedia("work_experience", id, "logo_path");
    }

    // Update main experience
    await db.work_experiences.update({
      where: { id },
      data: {
        name: name.trim(),
        position: position.trim(),
        location: location?.trim() || "",
        website: website?.trim() || null,
        description: description?.trim() || "",
        summary: summary?.trim() || "",
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        date_updated: new Date(),
      },
    });

    // Update achievements if provided
    if (achievementsJson) {
      const achievements: { title: string; description: string }[] = JSON.parse(
        achievementsJson,
      );

      // Delete existing achievements
      await db.work_experience_achievements.deleteMany({
        where: { work_experience: id },
      });

      // Create new achievements
      for (let i = 0; i < achievements.length; i++) {
        const ach = achievements[i];
        if (ach.title?.trim() || ach.description?.trim()) {
          await db.work_experience_achievements.create({
            data: {
              title: ach.title?.trim() || null,
              description: ach.description?.trim() || null,
              work_experience: id,
              sort: i,
              status: "published",
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
      await db.work_experience_technologies.deleteMany({
        where: { work_experience: id },
      });

      // Create new technologies
      for (let i = 0; i < technologies.length; i++) {
        const techName = technologies[i].trim();
        if (techName) {
          await db.work_experience_technologies.create({
            data: {
              name: techName,
              work_experience: id,
              sort: i,
              status: "published",
              date_created: new Date(),
            },
          });
        }
      }
    }

    return { success: true };
  },
};
