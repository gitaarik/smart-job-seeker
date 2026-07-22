import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat/application-question";
import { requireCredits } from "$lib/server/billing/require-credits";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const questionId = parseIntParam(params.id, "question");

  // Verify ownership: question -> application -> profile -> user
  const question = await db.query.application_questions.findFirst({
    where: eq(application_questions.id, questionId),
    with: {
      application: {
        with: { profile: { columns: { user_id: true } } },
      },
    },
  });

  if (!question || question.application.profile.user_id !== user.id) {
    return json({ success: false, message: "Question not found" }, {
      status: 404,
    });
  }

  // Optional body:
  //  - { commit: false } — draft flow: don't write the answer column.
  //  - { mode: "generate" | "advice" | "review" } — the timeline editor's
  //    first AI step when no thread exists yet. Absent/invalid keeps the
  //    default (commit + generate), so the list-page one-shot is unchanged.
  let commit = true;
  let mode: "generate" | "advice" | "review" = "generate";
  try {
    const body = await request.json();
    if (body && typeof body.commit === "boolean") commit = body.commit;
    if (
      body &&
      (body.mode === "generate" || body.mode === "advice" ||
        body.mode === "review")
    ) {
      mode = body.mode;
    }
  } catch {
    // no body → defaults
  }

  await requireCredits(user.id, 5);

  const result = await generateApplicationQuestionAnswer(questionId, {
    commitAnswer: commit,
    mode,
  });

  if (!result.success) {
    return json(result, { status: 422 });
  }

  return json(result);
};
