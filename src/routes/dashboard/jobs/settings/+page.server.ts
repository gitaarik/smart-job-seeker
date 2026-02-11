import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const jobSearches = await db.job_searches.findMany({
    where: { profile: layoutData.selectedProfile.id },
    include: {
      job_platforms: true,
    },
    orderBy: { date_created: "desc" },
  });

  const platforms = await db.job_platforms.findMany({
    where: { status: "published" },
    orderBy: { name: "asc" },
  });

  return {
    jobSearches,
    platforms,
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
    const name = formData.get("name") as string;
    const search_url = formData.get("search_url") as string;
    const platform = formData.get("platform") as string;
    const status = (formData.get("status") as string) || "active";

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    await db.job_searches.create({
      data: {
        name: name.trim(),
        search_url: search_url?.trim() || null,
        platform: platform ? parseInt(platform) : null,
        status,
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
    const name = formData.get("name") as string;
    const search_url = formData.get("search_url") as string;
    const platform = formData.get("platform") as string;
    const status = formData.get("status") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid search ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    const existing = await db.job_searches.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Job search not found" });
    }

    await db.job_searches.update({
      where: { id },
      data: {
        name: name.trim(),
        search_url: search_url?.trim() || null,
        platform: platform ? parseInt(platform) : null,
        status: status || "active",
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
      return fail(400, { error: "Invalid search ID" });
    }

    const existing = await db.job_searches.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Job search not found" });
    }

    await db.job_searches.delete({
      where: { id },
    });

    return { success: true };
  },
};
