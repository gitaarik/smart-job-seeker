/**
 * Create follow-up AI chat for application letters
 * This handler manages the application_letter-specific logic while delegating
 * the core follow-up creation to the reusable createFollowupAiChat function
 */

import { db } from "$lib/db";
import { createFollowupAiChat } from "./ai-chat-create-followup";

/**
 * Create a follow-up AI chat for an application letter
 *
 * Steps:
 * 1. Fetch the application_letter with current ai_chat reference
 * 2. Validate that ai_chat exists
 * 3. Call createFollowupAiChat to create the follow-up
 * 4. Update the application_letter to reference the new ai_chat
 *
 * @param letterId - The ID of the application letter
 * @param followupRequest - User's follow-up request describing what to refine
 * @param includeOriginalContext - Whether to include original context variables
 * @returns Object with success status, message, and created ai_chat if successful
 */
export async function createApplicationLetterFollowup(
  letterId: number,
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
  try {
    // Step 1: Fetch application_letter with ai_chat reference
    const letter = await db.application_letters.findUnique({
      where: { id: letterId },
      select: {
        id: true,
        ai_chat: true,
      },
    });

    if (!letter) {
      return {
        success: false,
        message: `Application letter with ID ${letterId} not found`,
      };
    }

    // Step 2: Validate that ai_chat exists
    if (!letter.ai_chat) {
      return {
        success: false,
        message:
          `Application letter ${letterId} does not have an ai_chat yet. Generate the initial letter first.`,
      };
    }

    // Step 3: Call createFollowupAiChat to create the follow-up
    const result = await createFollowupAiChat(
      letter.ai_chat,
      followupRequest,
      { includeOriginalContext },
    );

    if (!result.success || !result.aiChat) {
      return result;
    }

    // Step 4: Update application_letter with new ai_chat reference
    // This flow owns this update logic (separation of concerns)
    await db.application_letters.update({
      where: { id: letterId },
      data: {
        ai_chat: result.aiChat.id,
        ai_chat_response: result.aiChat.response,
      },
    });

    return {
      success: true,
      message:
        `Follow-up AI chat created successfully (ID: ${result.aiChat.id}). Application letter ${letterId} has been updated.`,
      aiChat: result.aiChat,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error creating application letter follow-up: ${errorMessage}`,
    };
  }
}
