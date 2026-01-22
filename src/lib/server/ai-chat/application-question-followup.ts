/**
 * Create follow-up AI chat for application questions
 * This handler manages the application_question-specific logic while delegating
 * the core follow-up creation to the reusable createFollowupAiChat function
 */

import { db } from "$lib/db";
import { createFollowupAiChat } from "./create-followup";

/**
 * Create a follow-up AI chat for an application question
 *
 * Steps:
 * 1. Fetch the application_questions with current ai_chat reference
 * 2. Validate that ai_chat exists
 * 3. Call createFollowupAiChat to create the follow-up
 * 4. Update the application_questions to reference the new ai_chat
 *
 * @param questionId - The ID of the application question
 * @param followupRequest - User's follow-up request describing what to refine
 * @param includeOriginalContext - Whether to include original context variables
 * @returns Object with success status, message, and created ai_chat if successful
 */
export async function createApplicationQuestionFollowup(
  questionId: number,
  followupRequest: string,
  includeOriginalContext?: boolean,
): Promise<{
  success: boolean;
  message: string;
  aiChat?: {
    id: number;
    profile: number;
    system_prompt: string;
    user_prompt: string;
    full_prompt: string | null;
    response: string | null;
    date_created: Date | null;
    date_updated: Date | null;
  };
}> {
  // Step 1: Fetch application_questions (try block for database query)
  let question;
  try {
    question = await db.application_questions.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        ai_chat: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error creating application question follow-up: ${errorMessage}`,
    };
  }

  // Step 2: Validation outside try block
  if (!question) {
    return {
      success: false,
      message: `Application question with ID ${questionId} not found`,
    };
  }

  if (!question.ai_chat) {
    return {
      success: false,
      message:
        `Application question ${questionId} does not have an ai_chat yet. Generate the initial answer first.`,
    };
  }

  // Step 3: Create follow-up (try block for async operation)
  let result;
  try {
    result = await createFollowupAiChat(
      question.ai_chat,
      followupRequest,
      { includeOriginalContext },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error creating followup: ${errorMessage}`,
    };
  }

  // Validation outside try block
  if (!result.success || !result.aiChat) {
    return result;
  }

  // Step 4: Update application_questions (try block for database update)
  try {
    await db.application_questions.update({
      where: { id: questionId },
      data: {
        ai_chat: result.aiChat.id,
        ai_chat_response: result.aiChat.response,
      },
    });
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
    message:
      `Follow-up AI chat created successfully (ID: ${result.aiChat.id}). Application question ${questionId} has been updated.`,
    aiChat: result.aiChat,
  };
}
