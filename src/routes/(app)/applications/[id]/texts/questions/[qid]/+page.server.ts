import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { applications, application_questions } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../../../profile/utils";
import {
  buildConversation,
  QUESTION_VERSIONS,
  recordVersionIfChanged,
  type VersionSource,
} from "$lib/server/ai-chat/entity-versions";

export const load: PageServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();
  const application = layoutData.application;

  const qid = parseInt(params.qid);
  if (isNaN(qid)) error(400, "Invalid question ID");

  const question = application.application_questions?.find(
    (q: { id: number }) => q.id === qid,
  );
  if (!question) error(404, "Question not found");

  // The saved-answer version trail (oldest→newest) powers the history panel.
  const conversation = await buildConversation(QUESTION_VERSIONS, qid);

  return { question, appId: parseInt(params.id), conversation };
};

export const actions: Actions = {
  // Commit the working draft as the definitive answer. AI iteration on this
  // page is non-committing; this action is the only writer of `answer`.
  save: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const qid = parseInt(params.qid);
    if (isNaN(qid)) return fail(400, { error: "Invalid question ID" });

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const question = await db.query.application_questions.findFirst({
      where: and(
        eq(application_questions.id, qid),
        eq(application_questions.application_id, appId),
      ),
    });
    if (!question) return fail(404, { error: "Question not found" });

    const formData = await request.formData();
    const answer = (formData.get("answer") as string | null)?.trim() || null;
    const questionText = (formData.get("question") as string | null)?.trim();

    // Provenance hint from the editor: whether the committed draft came from AI.
    const sourceRaw = formData.get("source");
    const source: VersionSource = sourceRaw === "ai_generation" || sourceRaw === "ai_revision"
      ? sourceRaw
      : "manual_edit";

    // The question text is NOT NULL; only overwrite it when a non-empty value
    // is provided, otherwise keep the existing one.
    if (formData.has("question") && !questionText) {
      return fail(400, { error: "Question text cannot be empty" });
    }

    await db.update(application_questions).set({
      answer,
      ...(questionText ? { question: questionText } : {}),
      date_updated: new Date(),
    }).where(eq(application_questions.id, qid));

    // Append a version when the answer actually changed — this is the trail the
    // history panel restores from. AI iteration on the page stays non-committing;
    // versions are captured only at this explicit save.
    await recordVersionIfChanged(QUESTION_VERSIONS, {
      entityId: qid,
      newContent: answer,
      previousContent: question.answer,
      source,
    });

    return { success: true };
  },
};
