import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const stories = await db.project_stories.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
  });

  return {
    stories,
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
    const category = formData.get("category") as string;
    const situation = formData.get("situation") as string;
    const task = formData.get("task") as string;
    const action = formData.get("action") as string;
    const result = formData.get("result") as string;
    const reflection = formData.get("reflection") as string;

    if (!title || title.trim().length === 0) {
      return fail(400, { error: "Title is required" });
    }

    await db.project_stories.create({
      data: {
        title: title.trim(),
        category: category?.trim() || null,
        situation: situation?.trim() || null,
        task: task?.trim() || null,
        action: action?.trim() || null,
        result: result?.trim() || null,
        reflection: reflection?.trim() || null,
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
    const category = formData.get("category") as string;
    const situation = formData.get("situation") as string;
    const task = formData.get("task") as string;
    const action = formData.get("action") as string;
    const result = formData.get("result") as string;
    const reflection = formData.get("reflection") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid story ID" });
    }

    if (!title || title.trim().length === 0) {
      return fail(400, { error: "Title is required" });
    }

    const existing = await db.project_stories.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Story not found" });
    }

    await db.project_stories.update({
      where: { id },
      data: {
        title: title.trim(),
        category: category?.trim() || null,
        situation: situation?.trim() || null,
        task: task?.trim() || null,
        action: action?.trim() || null,
        result: result?.trim() || null,
        reflection: reflection?.trim() || null,
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
      return fail(400, { error: "Invalid story ID" });
    }

    const existing = await db.project_stories.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Story not found" });
    }

    await db.project_stories.delete({
      where: { id },
    });

    return { success: true };
  },
};
