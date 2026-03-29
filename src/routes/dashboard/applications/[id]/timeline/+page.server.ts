import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";

export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.applications.findFirst({
      where: { id: appId, profile: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const description = formData.get("description") as string;

    if (!description?.trim()) {
      return fail(400, { error: "Description is required" });
    }

    await db.application_status_log.create({
      data: {
        application: appId,
        date_created: new Date(),
        from_status: existing.status,
        to_status: existing.status,
        description: description.trim(),
      },
    });

    return { success: true };
  },

  update: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.applications.findFirst({
      where: { id: appId, profile: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const description = formData.get("description") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid entry ID" });

    const entry = await db.application_status_log.findFirst({
      where: { id, application: appId },
    });
    if (!entry) return fail(404, { error: "Entry not found" });

    await db.application_status_log.update({
      where: { id },
      data: {
        description: description?.trim() || null,
      },
    });

    return { success: true };
  },

  delete: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.applications.findFirst({
      where: { id: appId, profile: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid entry ID" });

    const entry = await db.application_status_log.findFirst({
      where: { id, application: appId },
    });
    if (!entry) return fail(404, { error: "Entry not found" });

    await db.application_status_log.delete({ where: { id } });

    return { success: true };
  },
};
