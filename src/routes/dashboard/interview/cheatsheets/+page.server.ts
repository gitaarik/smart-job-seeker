import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const cheatsheets = await db.cheat_sheets.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
  });

  return {
    cheatsheets,
    profileId: layoutData.selectedProfile.id,
  };
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
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;

    if (!title || title.trim().length === 0) {
      return fail(400, { error: "Title is required" });
    }

    await db.cheat_sheets.create({
      data: {
        title: title.trim(),
        content: content?.trim() || null,
        profile: profileId,
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
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid cheat sheet ID" });
    }

    if (!title || title.trim().length === 0) {
      return fail(400, { error: "Title is required" });
    }

    const existing = await db.cheat_sheets.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Cheat sheet not found" });
    }

    await db.cheat_sheets.update({
      where: { id },
      data: {
        title: title.trim(),
        content: content?.trim() || null,
        date_updated: new Date(),
      },
    });

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
      return fail(400, { error: "Invalid cheat sheet ID" });
    }

    const existing = await db.cheat_sheets.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Cheat sheet not found" });
    }

    await db.cheat_sheets.delete({
      where: { id },
    });

    return { success: true };
  },
};
