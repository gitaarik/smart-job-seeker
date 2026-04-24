import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { languages } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const items = await db.query.languages.findMany({
    where: eq(languages.profile_id, layoutData.selectedProfile.id),
    orderBy: asc(languages.sort),
  });

  return { languages: items, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const language_code = formData.get("language_code") as string;
    const proficiency = formData.get("proficiency") as string;

    if (!name || name.trim().length === 0) return fail(400, { error: "Language name is required" });

    const lastItem = await db.query.languages.findFirst({
      where: eq(languages.profile_id, profileId),
      orderBy: desc(languages.sort),
    });

    await db.insert(languages).values({
      name: name.trim(),
      language_code: language_code?.trim() || null,
      proficiency: proficiency || null,
      profile_id: profileId,
      sort: (lastItem?.sort ?? -1) + 1,
      status: "published",
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
    const name = formData.get("name") as string;
    const language_code = formData.get("language_code") as string;
    const proficiency = formData.get("proficiency") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid language ID" });
    if (!name || name.trim().length === 0) return fail(400, { error: "Language name is required" });

    const existing = await db.query.languages.findFirst({
      where: and(eq(languages.id, id), eq(languages.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Language not found" });

    await db.update(languages).set({
      name: name.trim(),
      language_code: language_code?.trim() || null,
      proficiency: proficiency || null,
      date_updated: new Date(),
    }).where(eq(languages.id, id));

    return { success: true };
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid language ID" });

    const existing = await db.query.languages.findFirst({
      where: and(eq(languages.id, id), eq(languages.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Language not found" });

    await db.delete(languages).where(eq(languages.id, id));

    return { success: true };
  },
};
