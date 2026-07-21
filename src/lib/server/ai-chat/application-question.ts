/**
 * Generate AI-assisted answers for application questions
 * Creates an ai_chats record with context from collected_data, job description, and the question
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
import { createAndGenerateAiChat } from "./utils";

/** Profile data fields relevant for answering application questions */
export const QUESTION_PROFILE_FIELDS = [
  "name", "title", "headline", "subtitle", "summary", "location",
  "core_stack", "highlights",
  "work_experiences", "side_projects", "education",
  "tech_skill_categories", "languages",
  "project_stories", "references",
];

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
): Promise<{
  success: boolean;
  message: string;
}> {
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

  // Generate AI chat (try block for async operation)
  let aiChatResult;
  try {
    aiChatResult = await createAndGenerateAiChat(
      profileId,
      "answer_application_question",
      {
        jobDescription: jobDescription,
        question: question.question,
      },
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

  // Update the application_questions record (try block for database update)
  try {
    await db.update(application_questions).set({
      ai_chat_id: aiChat.id,
      ai_chat_response: aiChat.response,
      answer: aiChat.response,
    }).where(eq(application_questions.id, questionId));
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
    message: `Answer generated for question ID ${questionId}`,
  };
}
