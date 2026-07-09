import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { side_projects, side_project_achievements, side_project_technologies } from "$lib/server/db/schema";
import { getSelectedProfileId, touchProfile } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const projects = await db.query.side_projects.findMany({
    where: eq(side_projects.profile_id, layoutData.selectedProfile.id),
    // Postgres sorts ASC NULLS LAST, so when no project has a manual `sort`
    // the list falls through to date order; once reordered, `sort` wins.
    orderBy: [asc(side_projects.sort), desc(side_projects.start_date)],
    with: {
      side_project_achievements: {
        orderBy: asc(side_project_achievements.sort),
      },
      side_project_technologies: {
        orderBy: asc(side_project_technologies.sort),
      },
    },
  });

  const ordering: "date" | "manual" = projects.some((p) => p.sort !== null) ? "manual" : "date";

  return { projects, ordering, profileId: layoutData.selectedProfile.id };
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

    // New projects start unsorted (sort = null) so they slot into date order
    // by default; an explicit reorder is what switches the list to manual mode.
    const [created] = await db.insert(side_projects).values({
      name: name.trim(),
      url: url?.trim() || null,
      url_label: url_label?.trim() || null,
      summary: summary?.trim() || null,
      stars: stars ? parseInt(stars) : null,
      start_date: start_date || null,
      end_date: end_date || null,
      profile_id: profileId,
      sort: null,
      status: "published",
      date_created: new Date(),
    }).returning();

    await touchProfile(profileId);
    redirect(302, `/profile/side-projects/${created.id}`);
  },

  reorder: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    let order: unknown;
    try {
      order = JSON.parse(formData.get("order") as string);
    } catch {
      return fail(400, { error: "Invalid order" });
    }
    if (!Array.isArray(order)) return fail(400, { error: "Invalid order" });

    await Promise.all(
      order.map((id, index) =>
        db.update(side_projects)
          .set({ sort: index, date_updated: new Date() })
          .where(and(eq(side_projects.id, Number(id)), eq(side_projects.profile_id, profileId)))
      ),
    );

    await touchProfile(profileId);
    return { success: true };
  },

  resetOrder: async ({ locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    // Clear manual order — the list reverts to date ordering.
    await db.update(side_projects)
      .set({ sort: null, date_updated: new Date() })
      .where(eq(side_projects.profile_id, profileId));

    await touchProfile(profileId);
    return { success: true };
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

    await touchProfile(profileId);
    return { success: true };
  },
};
