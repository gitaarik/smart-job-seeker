import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat/application-question";
import { requireCredits } from "$lib/server/billing/require-credits";

export const POST: RequestHandler = async ({ params, locals }) => {
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
    return json({ success: false, message: "Question not found" }, { status: 404 });
  }

  await requireCredits(user.id, 5);

  const result = await generateApplicationQuestionAnswer(questionId);

  if (!result.success) {
    return json(result, { status: 422 });
  }

  return json(result);
};
