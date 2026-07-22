/**
 * Generate AI-assisted answers for application questions
 * Creates an ai_chats record with context from collected_data, job description, and the question
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
import { createAndGenerateAiChat } from "./utils";
import {
  ensureBaselineVersion,
  QUESTION_VERSIONS,
  recordVersion,
} from "./entity-versions";

/** Profile data fields relevant for answering application questions */
export const QUESTION_PROFILE_FIELDS = [
  "name",
  "title",
  "headline",
  "subtitle",
  "summary",
  "location",
  "core_stack",
  "highlights",
  "work_experiences",
  "side_projects",
  "education",
  "tech_skill_categories",
  "languages",
  "project_stories",
  "references",
];

/** Maps generation mode to the prompt template name. */
const QUESTION_MODE_TO_PROMPT: Record<string, string> = {
  generate: "answer_application_question",
  advice: "advise_application_question",
  review: "review_application_question",
};

/**
 * Generate answer for a single application question
 * Steps:
 * 1. Fetch the question, application, and related data
 * 2. Create an ai_chats record with system_prompt including ${jobDescription} placeholder
 * 3. Generate the full prompt (variables will be replaced including job description)
 * 4. Generate the AI response
 * 5. Update the application_questions record with the ai_chats reference
 */
export async function generateApplicationQuestionAnswer(
  questionId: number,
  opts?: {
    /**
     * When false, persist the generated text to the ai_chat thread but NOT to
     * `answer` — used by the list-page draft flow. Defaults to true so the
     * one-shot "Generate" writes the answer straight away. Only applies to
     * `mode: "generate"`.
     */
    commitAnswer?: boolean;
    /**
     * Which AI step to run. "generate" writes an answer, "advice" returns
     * job-specific pointers (no content), "review" critiques the current
     * answer and may propose a revision. Each records a version through the
     * shared engine so the timeline editor can render the thread.
     */
    mode?: "generate" | "advice" | "review";
  },
): Promise<{
  success: boolean;
  message: string;
  /** The generated answer text (present on success). */
  text?: string;
}> {
  const commitAnswer = opts?.commitAnswer ?? true;
  const mode = opts?.mode ?? "generate";
  const promptType = QUESTION_MODE_TO_PROMPT[mode];
  // Fetch the question (try block for database query)
  let question;
  try {
    question = await db.query.application_questions.findFirst({
      where: eq(application_questions.id, questionId),
      with: {
        application: {
          with: {
            job: true,
          },
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Database error fetching question: ${errorMessage}`,
    };
  }

  // Validation outside try block
  if (!question) {
    return {
      success: false,
      message: `Application question with ID ${questionId} not found`,
    };
  }

  const profileId = question.application.profile_id;
  const jobDescription = question.application.job?.job_description || "";

  const variables: Record<string, unknown> = {
    jobDescription: jobDescription,
    question: question.question,
  };
  // Review critiques the answer the applicant already has.
  if (mode === "review") {
    variables.answer = question.answer || "";
  }

  // Generate AI chat (try block for async operation)
  let aiChatResult;
  try {
    aiChatResult = await createAndGenerateAiChat(
      profileId,
      promptType,
      variables,
      undefined,
      { profileDataFields: QUESTION_PROFILE_FIELDS },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating AI chat: ${errorMessage}`,
    };
  }

  // Validation outside try block
  if (!aiChatResult.success || !aiChatResult.aiChat) {
    return {
      success: false,
      message: aiChatResult.message,
    };
  }

  const aiChat = aiChatResult.aiChat;

  // Extract the answer text + feedback per mode. generate returns structured
  // { text, feedback }; advice is plain text; review returns structured
  // { feedback, revisedText }.
  let answerText: string | null = null;
  let aiFeedback: string | null = null;
  if (mode === "generate") {
    answerText = aiChat.response;
    if (aiChat.response) {
      try {
        const parsed = JSON.parse(aiChat.response);
        if (parsed && typeof parsed.text === "string") answerText = parsed.text;
        if (parsed && typeof parsed.feedback === "string") {
          aiFeedback = parsed.feedback;
        }
      } catch {
        // Not JSON, keep the raw response as the answer.
      }
    }
  } else if (mode === "advice") {
    aiFeedback = aiChat.response;
  } else if (mode === "review") {
    if (aiChat.response) {
      try {
        const parsed = JSON.parse(aiChat.response);
        aiFeedback = typeof parsed.feedback === "string"
          ? parsed.feedback
          : aiChat.response;
        answerText = typeof parsed.revisedText === "string"
          ? parsed.revisedText
          : null;
      } catch {
        aiFeedback = aiChat.response;
      }
    }
  }

  // Update the application_questions record (try block for database update).
  // The answer column is written only for a committed generation.
  try {
    // Preserve a pre-version-era answer as a baseline before this AI turn, so
    // the original survives instead of the AI version becoming the only one.
    await ensureBaselineVersion(QUESTION_VERSIONS, questionId, question.answer);

    await db.update(application_questions).set({
      ai_chat_id: aiChat.id,
      ai_chat_response: aiChat.response,
      ...(mode === "generate" && commitAnswer ? { answer: answerText } : {}),
    }).where(eq(application_questions.id, questionId));

    // Record a version through the shared engine so the timeline editor can
    // render the thread (mirrors generateApplicationLetter).
    if (mode === "review") {
      await recordVersion(QUESTION_VERSIONS, {
        entityId: questionId,
        content: answerText,
        source: "ai_review",
        aiChatId: aiChat.id,
        aiFeedback,
      });
    } else if (mode === "advice") {
      await recordVersion(QUESTION_VERSIONS, {
        entityId: questionId,
        content: null,
        source: "ai_advice",
        aiChatId: aiChat.id,
        aiFeedback,
      });
    } else if (mode === "generate" && answerText) {
      await recordVersion(QUESTION_VERSIONS, {
        entityId: questionId,
        content: answerText,
        source: "ai_generation",
        aiChatId: aiChat.id,
        aiFeedback,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error updating question record: ${errorMessage}`,
    };
  }

  // Final result construction outside try block
  return {
    success: true,
    message: `Answer ${mode} completed for question ID ${questionId}`,
    text: answerText ?? undefined,
  };
}
