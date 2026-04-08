import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const highlights = await db.highlights.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
  });

  return { highlights, profileId: layoutData.selectedProfile.id };
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
    const text = formData.get("text") as string;
    const icon_name = formData.get("icon_name") as string;

    if (!text || text.trim().length === 0) {
      return fail(400, { error: "Highlight text is required" });
    }

    // Get the highest sort value
    const lastItem = await db.highlights.findFirst({
      where: { profile: profileId },
      orderBy: { sort: "desc" },
    });

    await db.highlights.create({
      data: {
        text: text.trim(),
        icon_name: icon_name?.trim() || null,
        profile: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        type: "highlight",
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
    const text = formData.get("text") as string;
    const icon_name = formData.get("icon_name") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid highlight ID" });
    }

    if (!text || text.trim().length === 0) {
      return fail(400, { error: "Highlight text is required" });
    }

    // Verify ownership
    const existing = await db.highlights.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Highlight not found" });
    }

    await db.highlights.update({
      where: { id },
      data: {
        text: text.trim(),
        icon_name: icon_name?.trim() || null,
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
      return fail(400, { error: "Invalid highlight ID" });
    }

    // Verify ownership
    const existing = await db.highlights.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Highlight not found" });
    }

    await db.highlights.delete({
      where: { id },
    });

    return { success: true };
  },
};
