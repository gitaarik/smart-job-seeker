import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const experiences = await db.work_experiences.findMany({
    where: { profile_id: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
    include: {
      work_experience_achievements: {
        orderBy: { sort: "asc" },
      },
      work_experience_technologies: {
        orderBy: { sort: "asc" },
      },
    },
  });

  return { experiences, profileId: layoutData.selectedProfile.id };
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
    const position = formData.get("position") as string;
    const location = formData.get("location") as string;
    const website = formData.get("website") as string;
    const description = formData.get("description") as string;
    const summary = formData.get("summary") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Company name is required" });
    }

    if (!position || position.trim().length === 0) {
      return fail(400, { error: "Position is required" });
    }

    // Get the highest sort value
    const lastItem = await db.work_experiences.findFirst({
      where: { profile_id: profileId },
      orderBy: { sort: "desc" },
    });

    const created = await db.work_experiences.create({
      data: {
        name: name.trim(),
        position: position.trim(),
        location: location?.trim() || "",
        website: website?.trim() || null,
        description: description?.trim() || "",
        summary: summary?.trim() || "",
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        profile_id: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        date_created: new Date(),
      },
    });

    // Redirect to edit page for the new experience
    redirect(302, `/dashboard/profile/work-experience/${created.id}`);
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
      return fail(400, { error: "Invalid experience ID" });
    }

    // Verify ownership
    const existing = await db.work_experiences.findFirst({
      where: { id, profile_id: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Experience not found" });
    }

    // Delete will cascade to achievements, technologies, projects
    await db.work_experiences.delete({
      where: { id },
    });

    return { success: true };
  },
};
