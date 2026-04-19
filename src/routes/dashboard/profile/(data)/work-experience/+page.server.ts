import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { work_experiences, work_experience_achievements, work_experience_technologies } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const experiences = await db.query.work_experiences.findMany({
    where: eq(work_experiences.profile_id, layoutData.selectedProfile.id),
    orderBy: asc(work_experiences.sort),
    with: {
      work_experience_achievements: {
        orderBy: asc(work_experience_achievements.sort),
      },
      work_experience_technologies: {
        orderBy: asc(work_experience_technologies.sort),
      },
    },
  });

  return { experiences, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const position = formData.get("position") as string;
    const location = formData.get("location") as string;
    const website = formData.get("website") as string;
    const description = formData.get("description") as string;
    const summary = formData.get("summary") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;

    if (!name || name.trim().length === 0) return fail(400, { error: "Company name is required" });
    if (!position || position.trim().length === 0) return fail(400, { error: "Position is required" });

    const lastItem = await db.query.work_experiences.findFirst({
      where: eq(work_experiences.profile_id, profileId),
      orderBy: desc(work_experiences.sort),
    });

    const [created] = await db.insert(work_experiences).values({
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
    }).returning();

    redirect(302, `/dashboard/profile/work-experience/${created.id}`);
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid experience ID" });

    const existing = await db.query.work_experiences.findFirst({
      where: and(eq(work_experiences.id, id), eq(work_experiences.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Experience not found" });

    await db.delete(work_experiences).where(eq(work_experiences.id, id));

    return { success: true };
  },
};
