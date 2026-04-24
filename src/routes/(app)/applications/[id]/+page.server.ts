import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { applications, application_status_log } from "$lib/server/db/schema";
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

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const status = formData.get("status") as string;
    const step = (formData.get("step") as string)?.trim() || null;
    const action = (formData.get("action") as string)?.trim() || null;
    const actionDate = (formData.get("action_date") as string)?.trim() || null;
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
      status_action_date: actionDate ? new Date(actionDate) : null,
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

    await db.update(applications).set(updateData).where(eq(applications.id, appId));

    await db.insert(application_status_log).values({
      application: appId,
      date_created: now,
      from_status: existing.status,
      to_status: status,
      step,
      action,
      action_date: actionDate ? new Date(actionDate) : null,
      description: description || null,
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

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const note = formData.get("note") as string;

    await db.update(applications).set({
      application_note: note || null,
      date_updated: new Date(),
    }).where(eq(applications.id, appId));

    return { success: true };
  },

  updateDetails: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
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

    await db.update(applications).set({
      cv_sent_through: cv_sent_through || null,
      application_sent_date: application_sent_date
        ? new Date(application_sent_date)
        : null,
      application_seen_date: application_seen_date
        ? new Date(application_seen_date)
        : null,
      date_updated: new Date(),
    }).where(eq(applications.id, appId));

    return { success: true };
  },

  delete: async ({ locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    await db.delete(applications).where(eq(applications.id, appId));

    redirect(303, "/applications/active");
  },
};
