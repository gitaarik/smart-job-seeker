import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  updateStatus: async ({ request, locals, cookies, params }) => {
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
    const status = formData.get("status") as string;
    const step = (formData.get("step") as string)?.trim() || null;
    const action = (formData.get("action") as string)?.trim() || null;
    const description = (formData.get("description") as string)?.trim() || null;

    const phaseChanged = status !== existing.status;
    const stepChanged = step !== (existing.status_step || "");
    const actionChanged = action !== (existing.status_action || "");

    // Nothing changed
    if (!phaseChanged && !stepChanged && !actionChanged && !description) {
      return { success: true };
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status,
      status_step: step,
      status_action: action,
      date_updated: now,
    };

    // Auto-set applied date when status changes to "sent" (Applied)
    if (status === "sent" && !existing.application_sent_date) {
      updateData.application_sent_date = now;
    }

    // Clear step/action when phase changes (unless new ones were selected)
    if (phaseChanged && !step) {
      updateData.status_step = null;
    }
    if (phaseChanged && !action) {
      updateData.status_action = null;
    }

    await db.applications.update({
      where: { id: appId },
      data: updateData,
    });

    // Build log description from step + action + optional note
    const logParts: string[] = [];
    if (step) logParts.push(step);
    if (action) logParts.push(action);
    if (description) logParts.push(description);
    const logDescription = logParts.join(" — ") || null;

    await db.application_status_log.create({
      data: {
        application: appId,
        date_created: now,
        from_status: existing.status,
        to_status: status,
        description: logDescription,
      },
    });

    return { success: true };
  },

  updateNote: async ({ request, locals, cookies, params }) => {
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
    const note = formData.get("note") as string;

    await db.applications.update({
      where: { id: appId },
      data: {
        application_note: note || null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  updateDetails: async ({ request, locals, cookies, params }) => {
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
    const cv_sent_through = formData.get("cv_sent_through") as string;
    const application_sent_date = formData.get(
      "application_sent_date",
    ) as string;
    const application_seen_date = formData.get(
      "application_seen_date",
    ) as string;

    await db.applications.update({
      where: { id: appId },
      data: {
        cv_sent_through: cv_sent_through || null,
        application_sent_date: application_sent_date
          ? new Date(application_sent_date)
          : null,
        application_seen_date: application_seen_date
          ? new Date(application_seen_date)
          : null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  delete: async ({ locals, cookies, params }) => {
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

    await db.applications.delete({
      where: { id: appId },
    });

    redirect(303, "/dashboard/applications/active");
  },
};
