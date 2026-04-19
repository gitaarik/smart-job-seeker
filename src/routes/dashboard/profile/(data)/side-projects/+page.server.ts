import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const projects = await db.query.side_projects.findMany({
    where: { profile_id: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
    with: {
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
    const lastItem = await db.query.side_projects.findFirst({
      where: { profile_id: profileId },
      orderBy: { sort: "desc" },
    });

    const created = await db.side_projects.create({
      data: {
        name: name.trim(),
        url: url?.trim() || null,
        url_label: url_label?.trim() || null,
        summary: summary?.trim() || null,
        stars: stars ? parseInt(stars) : null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        profile_id: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        date_created: new Date(),
      },
    });

    // Redirect to edit page for the new project
    redirect(302, `/dashboard/profile/side-projects/${created.id}`);
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
    const existing = await db.query.side_projects.findFirst({
      where: { id, profile_id: profileId },
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
