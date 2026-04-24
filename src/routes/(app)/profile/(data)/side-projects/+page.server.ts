import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { side_projects, side_project_achievements, side_project_technologies } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const projects = await db.query.side_projects.findMany({
    where: eq(side_projects.profile_id, layoutData.selectedProfile.id),
    orderBy: asc(side_projects.sort),
    with: {
      side_project_achievements: {
        orderBy: asc(side_project_achievements.sort),
      },
      side_project_technologies: {
        orderBy: asc(side_project_technologies.sort),
      },
    },
  });

  return { projects, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const url = formData.get("url") as string;
    const url_label = formData.get("url_label") as string;
    const summary = formData.get("summary") as string;
    const stars = formData.get("stars") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;

    if (!name || name.trim().length === 0) return fail(400, { error: "Project name is required" });

    const lastItem = await db.query.side_projects.findFirst({
      where: eq(side_projects.profile_id, profileId),
      orderBy: desc(side_projects.sort),
    });

    const [created] = await db.insert(side_projects).values({
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
    }).returning();

    redirect(302, `/profile/side-projects/${created.id}`);
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid project ID" });

    const existing = await db.query.side_projects.findFirst({
      where: and(eq(side_projects.id, id), eq(side_projects.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Project not found" });

    await db.delete(side_projects).where(eq(side_projects.id, id));

    return { success: true };
  },
};
