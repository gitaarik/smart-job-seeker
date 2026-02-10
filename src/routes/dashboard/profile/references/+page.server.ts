import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const references = await db.references.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
  });

  return { references, profileId: layoutData.selectedProfile.id };
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
    const author = formData.get("author") as string;
    const author_position = formData.get("author_position") as string;
    const text = formData.get("text") as string;

    if (!author || author.trim().length === 0) {
      return fail(400, { error: "Author name is required" });
    }

    // Get the highest sort value
    const lastItem = await db.references.findFirst({
      where: { profile: profileId },
      orderBy: { sort: "desc" },
    });

    await db.references.create({
      data: {
        author: author.trim(),
        author_position: author_position?.trim() || null,
        text: text?.trim() || null,
        profile: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
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
    const author = formData.get("author") as string;
    const author_position = formData.get("author_position") as string;
    const text = formData.get("text") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid reference ID" });
    }

    if (!author || author.trim().length === 0) {
      return fail(400, { error: "Author name is required" });
    }

    // Verify ownership
    const existing = await db.references.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Reference not found" });
    }

    await db.references.update({
      where: { id },
      data: {
        author: author.trim(),
        author_position: author_position?.trim() || null,
        text: text?.trim() || null,
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
      return fail(400, { error: "Invalid reference ID" });
    }

    // Verify ownership
    const existing = await db.references.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Reference not found" });
    }

    await db.references.delete({
      where: { id },
    });

    return { success: true };
  },
};
