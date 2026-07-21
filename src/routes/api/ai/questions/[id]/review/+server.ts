/**
 * POST /api/ai/questions/[id]/review
 *
 * Reviews the answer the applicant has ALREADY WRITTEN to an application
 * question and returns concise feedback plus an optional revised version.
 * Unlike /generate (which writes the AI answer straight into the row), this
 * is non-destructive: it returns { feedback, revisedText } for the client to
 * display. The user applies the revision themselves via the edit form, so
 * their original wording is never overwritten without consent.
 *
 * Requires the question to already have an answer — there's nothing to
 * review otherwise.
 *
 * Returns: { success: true, feedback: string, revisedText: string | null }
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { QUESTION_PROFILE_FIELDS } from "$lib/server/ai-chat/application-question";
import { reviewLetterSchema } from "$lib/server/schemas/ai-prompt-schemas";
import { requireCredits } from "$lib/server/billing/require-credits";

export const POST: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const questionId = parseIntParam(params.id, "question");

  // Verify ownership: question -> application -> profile -> user, and pull the
  // job description for grounding.
  const question = await db.query.application_questions.findFirst({
    where: eq(application_questions.id, questionId),
    with: {
      application: {
        with: {
          job: { columns: { job_description: true } },
          profile: { columns: { user_id: true } },
        },
      },
    },
  });

  if (!question || question.application.profile.user_id !== user.id) {
    return json({ success: false, message: "Question not found" }, { status: 404 });
  }

  if (!question.answer?.trim()) {
    return json(
      { success: false, message: "Write an answer before requesting a review" },
      { status: 400 },
    );
  }

  await requireCredits(user.id, 5);

  const result = await createAndGenerateAiChat(
    question.application.profile_id,
    "review_application_question",
    {
      jobDescription: question.application.job?.job_description || "",
      question: question.question,
      answer: question.answer,
    },
    undefined,
    { profileDataFields: QUESTION_PROFILE_FIELDS },
  );

  if (!result.success || !result.aiChat?.response) {
    return json(
      { success: false, message: result.message || "Review failed" },
      { status: 422 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.aiChat.response);
  } catch {
    return json(
      { success: false, message: "AI returned non-JSON response" },
      { status: 502 },
    );
  }

  const validated = reviewLetterSchema.safeParse(parsed);
  if (!validated.success) {
    return json(
      { success: false, message: "AI response failed validation" },
      { status: 502 },
    );
  }

  return json({
    success: true,
    feedback: validated.data.feedback,
    revisedText: validated.data.revisedText,
  });
};
