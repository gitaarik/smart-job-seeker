import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const versions = await db.profile_versions.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { date_created: "desc" },
  });

  return {
    versions,
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
    const description = formData.get("description") as string;
    const status = (formData.get("status") as string) || "draft";

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    await db.profile_versions.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        status,
        profile: profileId,
        date_created: new Date(),
      },
    });

    generateVersionPdfs(profileId, name.trim()).catch(console.error);

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
    const description = formData.get("description") as string;
    const status = formData.get("status") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid version ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    const existing = await db.profile_versions.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Version not found" });
    }

    await db.profile_versions.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        status: status || "draft",
        date_updated: new Date(),
      },
    });

    generateVersionPdfs(profileId, name.trim()).catch(console.error);

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
      return fail(400, { error: "Invalid version ID" });
    }

    const existing = await db.profile_versions.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Version not found" });
    }

    await db.profile_versions.delete({
      where: { id },
    });

    return { success: true };
  },
};
