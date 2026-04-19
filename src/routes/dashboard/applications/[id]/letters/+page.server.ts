import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";

export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  createQuestion: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: { id: appId, profile_id: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const question = formData.get("question") as string;

    if (!question?.trim()) {
      return fail(400, { error: "Question text is required" });
    }

    // Get the next sort order
    const lastQuestion = await db.query.application_questions.findFirst({
      where: { application_id: appId },
      orderBy: { sort: "desc" },
    });

    await db.application_questions.create({
      data: {
        application_id: appId,
        question: question.trim(),
        sort: (lastQuestion?.sort ?? 0) + 1,
        date_created: new Date(),
      },
    });

    return { success: true };
  },

  updateLetter: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: { id: appId, profile_id: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const content = formData.get("content") as string;
    const status = formData.get("status") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid letter ID" });

    const letter = await db.query.application_letters.findFirst({
      where: { id, application_id: appId },
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    await db.application_letters.update({
      where: { id },
      data: {
        content: content || null,
        status: status || "draft",
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  updateQuestion: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: { id: appId, profile_id: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const answer = formData.get("answer") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid question ID" });

    const question = await db.query.application_questions.findFirst({
      where: { id, application_id: appId },
    });
    if (!question) return fail(404, { error: "Question not found" });

    await db.application_questions.update({
      where: { id },
      data: {
        answer: answer || null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  deleteLetter: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: { id: appId, profile_id: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid letter ID" });

    const letter = await db.query.application_letters.findFirst({
      where: { id, application_id: appId },
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    await db.application_letters.delete({ where: { id } });

    return { success: true };
  },

  deleteQuestion: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: { id: appId, profile_id: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid question ID" });

    const question = await db.query.application_questions.findFirst({
      where: { id, application_id: appId },
    });
    if (!question) return fail(404, { error: "Question not found" });

    await db.application_questions.delete({ where: { id } });

    return { success: true };
  },
};
