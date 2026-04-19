import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { highlights } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const items = await db.query.highlights.findMany({
    where: eq(highlights.profile_id, layoutData.selectedProfile.id),
    orderBy: asc(highlights.sort),
  });

  return { highlights: items, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const text = formData.get("text") as string;
    const icon_name = formData.get("icon_name") as string;

    if (!text || text.trim().length === 0) {
      return fail(400, { error: "Highlight text is required" });
    }

    const lastItem = await db.query.highlights.findFirst({
      where: eq(highlights.profile_id, profileId),
      orderBy: desc(highlights.sort),
    });

    await db.insert(highlights).values({
      text: text.trim(),
      icon_name: icon_name?.trim() || null,
      profile_id: profileId,
      sort: (lastItem?.sort ?? -1) + 1,
      status: "published",
      type: "highlight",
      date_created: new Date(),
    });

    return { success: true };
  },

  update: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const text = formData.get("text") as string;
    const icon_name = formData.get("icon_name") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid highlight ID" });
    if (!text || text.trim().length === 0) return fail(400, { error: "Highlight text is required" });

    const existing = await db.query.highlights.findFirst({
      where: and(eq(highlights.id, id), eq(highlights.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Highlight not found" });

    await db.update(highlights).set({
      text: text.trim(),
      icon_name: icon_name?.trim() || null,
      date_updated: new Date(),
    }).where(eq(highlights.id, id));

    return { success: true };
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid highlight ID" });

    const existing = await db.query.highlights.findFirst({
      where: and(eq(highlights.id, id), eq(highlights.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Highlight not found" });

    await db.delete(highlights).where(eq(highlights.id, id));

    return { success: true };
  },
};
