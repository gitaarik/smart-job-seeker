import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc } from "drizzle-orm";
import { applications, application_letters, application_questions } from "$lib/server/db/schema";
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
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const question = formData.get("question") as string;
    const answer = (formData.get("answer") as string | null)?.trim() || null;

    if (!question?.trim()) {
      return fail(400, { error: "Question text is required" });
    }

    // Get the next sort order
    const lastQuestion = await db.query.application_questions.findFirst({
      where: eq(application_questions.application_id, appId),
      orderBy: desc(application_questions.sort),
    });

    const [created] = await db.insert(application_questions).values({
      application_id: appId,
      question: question.trim(),
      answer,
      sort: (lastQuestion?.sort ?? 0) + 1,
      date_created: new Date(),
    }).returning({ id: application_questions.id });

    // Return the new id so the client can chain an AI action (e.g. review)
    // without a round-trip to look it up.
    return { success: true, questionId: created.id };
  },

  createQuestions: async ({ request, locals, cookies, params }) => {
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
    const raw = formData.get("questions") as string;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail(400, { error: "Invalid questions payload" });
    }
    if (!Array.isArray(parsed)) {
      return fail(400, { error: "Invalid questions payload" });
    }

    const entries = parsed.map((e) => ({
      question: typeof (e as { question?: unknown })?.question === "string"
        ? ((e as { question: string }).question).trim()
        : "",
      answer: typeof (e as { answer?: unknown })?.answer === "string"
        ? ((e as { answer: string }).answer).trim()
        : "",
    }));

    // Drop rows with nothing in them, but reject the whole batch if any row
    // has an answer without a question — `question` is NOT NULL and we won't
    // silently discard the user's text. The preview UI enforces this too.
    const nonEmpty = entries.filter((e) => e.question || e.answer);
    if (nonEmpty.length === 0) {
      return fail(400, { error: "No questions to add" });
    }
    if (nonEmpty.some((e) => !e.question)) {
      return fail(400, {
        error: "Every answer needs a question before saving",
      });
    }

    const lastQuestion = await db.query.application_questions.findFirst({
      where: eq(application_questions.application_id, appId),
      orderBy: desc(application_questions.sort),
    });

    let sort = lastQuestion?.sort ?? 0;
    const now = new Date();
    await db.insert(application_questions).values(
      nonEmpty.map((e) => ({
        application_id: appId,
        question: e.question,
        answer: e.answer || null,
        sort: ++sort,
        date_created: now,
      })),
    );

    return { success: true, added: nonEmpty.length };
  },

  updateLetter: async ({ request, locals, cookies, params }) => {
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
    const id = parseInt(formData.get("id") as string);
    const content = formData.get("content") as string;
    const status = formData.get("status") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid letter ID" });

    const letter = await db.query.application_letters.findFirst({
      where: and(eq(application_letters.id, id), eq(application_letters.application_id, appId)),
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    await db.update(application_letters).set({
      content: content || null,
      status: status || "draft",
      date_updated: new Date(),
    }).where(eq(application_letters.id, id));

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
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const answer = formData.get("answer") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid question ID" });

    const question = await db.query.application_questions.findFirst({
      where: and(eq(application_questions.id, id), eq(application_questions.application_id, appId)),
    });
    if (!question) return fail(404, { error: "Question not found" });

    await db.update(application_questions).set({
      answer: answer || null,
      date_updated: new Date(),
    }).where(eq(application_questions.id, id));

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
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid letter ID" });

    const letter = await db.query.application_letters.findFirst({
      where: and(eq(application_letters.id, id), eq(application_letters.application_id, appId)),
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    await db.delete(application_letters).where(eq(application_letters.id, id));

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
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid question ID" });

    const question = await db.query.application_questions.findFirst({
      where: and(eq(application_questions.id, id), eq(application_questions.application_id, appId)),
    });
    if (!question) return fail(404, { error: "Question not found" });

    await db.delete(application_questions).where(eq(application_questions.id, id));

    return { success: true };
  },
};
