import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const languages = await db.languages.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
  });

  return { languages, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, parent }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const layoutData = await parent();
    if (!layoutData.selectedProfile) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const language_code = formData.get("language_code") as string;
    const proficiency = formData.get("proficiency") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Language name is required" });
    }

    // Get the highest sort value
    const lastItem = await db.languages.findFirst({
      where: { profile: layoutData.selectedProfile.id },
      orderBy: { sort: "desc" },
    });

    await db.languages.create({
      data: {
        name: name.trim(),
        language_code: language_code?.trim() || null,
        proficiency: proficiency || null,
        profile: layoutData.selectedProfile.id,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        date_created: new Date(),
      },
    });

    return { success: true };
  },

  update: async ({ request, locals, parent }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const layoutData = await parent();
    if (!layoutData.selectedProfile) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const name = formData.get("name") as string;
    const language_code = formData.get("language_code") as string;
    const proficiency = formData.get("proficiency") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid language ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Language name is required" });
    }

    // Verify ownership
    const existing = await db.languages.findFirst({
      where: { id, profile: layoutData.selectedProfile.id },
    });

    if (!existing) {
      return fail(404, { error: "Language not found" });
    }

    await db.languages.update({
      where: { id },
      data: {
        name: name.trim(),
        language_code: language_code?.trim() || null,
        proficiency: proficiency || null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  delete: async ({ request, locals, parent }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const layoutData = await parent();
    if (!layoutData.selectedProfile) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);

    if (isNaN(id)) {
      return fail(400, { error: "Invalid language ID" });
    }

    // Verify ownership
    const existing = await db.languages.findFirst({
      where: { id, profile: layoutData.selectedProfile.id },
    });

    if (!existing) {
      return fail(404, { error: "Language not found" });
    }

    await db.languages.delete({
      where: { id },
    });

    return { success: true };
  },
};
