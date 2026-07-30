import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  parseBody,
  questionGenerateSchema,
} from "$lib/server/validation/api-schemas";
import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat/application-question";
import { trackGeneration } from "$lib/server/ai-chat/ai-generation-status";
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
  //  - { mode } — which AI step to run (the timeline editor's first turn).
  //  - { instructions } — the applicant's brief for this turn.
  // An absent body keeps the defaults (commit + generate), so the list-page
  // one-shot is unchanged.
  const body = await request.json().catch(() => ({}));
  const { commit, mode, instructions } = parseBody(
    questionGenerateSchema,
    body,
  );

  await requireCredits(user.id, 5);

  const result = await trackGeneration(
    "question",
    questionId,
    mode,
    () =>
      generateApplicationQuestionAnswer(questionId, {
        commitAnswer: commit,
        mode,
        instructions,
      }),
  );

  if (!result.success) {
    return json(result, { status: 422 });
  }

  return json(result);
};
