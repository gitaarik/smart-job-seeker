import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat/application-question";
import { requireCredits } from "$lib/server/billing/credits";

export const POST: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const questionId = parseIntParam(params.id, "question");

  // Verify ownership: question -> application -> profile -> user
  const question = await db.application_questions.findFirst({
    where: { id: questionId },
    include: {
      applications: {
        include: { profiles: { select: { user_id: true } } },
      },
    },
  });

  if (!question || question.applications.profiles.user_id !== user.id) {
    return json({ success: false, message: "Question not found" }, { status: 404 });
  }

  await requireCredits(user.id, 5);

  const result = await generateApplicationQuestionAnswer(questionId);

  if (!result.success) {
    return json(result, { status: 422 });
  }

  return json(result);
};
