/**
 * Create follow-up ai_chat instances for iterative refinement
 */

import { db } from "$lib/db";
import { createAndGenerateAiChat, interpolatePrompt } from "./ai-chat-utils";

/**
 * Escape variable placeholders in a string to prevent auto-interpolation
 * Converts ${variableName} to \${variableName}
 */
function escapePlaceholders(text: string): string {
  return text.replace(/\$\{/g, "\\${");
}

/**
 * Create a follow-up ai_chat instance to refine a previous AI-generated response
 *
 * The follow-up will include:
 * - The previous response (so AI knows what to refine)
 * - The follow-up request (what the user wants to change)
 * - Optionally, the original context (schema, data, jobDescription, etc.)
 *
 * @param parentAiChatId - The ID of the parent ai_chat record to follow up on
 * @param followupRequest - The user's follow-up request describing what to refine
 * @param options - Configuration options
 * @param options.includeOriginalContext - If true, interpolate parent's context variables into the prompts (default: false)
 * @returns Object with success status, message, and the created ai_chat record (if successful)
 */
export async function createFollowupAiChat(
  parentAiChatId: number,
  followupRequest: string,
  options?: {
    includeOriginalContext?: boolean;
  },
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
  const includeOriginalContext = options?.includeOriginalContext ?? false;

  // Step 1: Fetch parent ai_chat record (try block for database query)
  let parent;
  try {
    parent = await db.ai_chat.findUnique({
      where: { id: parentAiChatId },
      select: {
        profile: true,
        context: true,
        response: true,
        system_prompt: true,
        user_prompt: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Database error fetching parent ai_chat: ${errorMessage}`,
    };
  }

  // Step 2: Validation outside try block
  if (!parent) {
    return {
      success: false,
      message: `Parent ai_chat with ID ${parentAiChatId} not found`,
    };
  }

  if (!parent.response) {
    return {
      success: false,
      message:
        `Parent ai_chat ${parentAiChatId} does not have a response yet. Cannot create follow-up.`,
    };
  }

  // Step 3: Prepare custom variables (string operations outside try block)
  const parentContext = (parent.context as Record<string, unknown>) || {};

  let originalSystemPrompt: string;
  let originalUserPrompt: string;

  if (includeOriginalContext) {
    // Convert parent context to string format for interpolation
    const parentContextForInterpolation: Record<string, string> = Object
      .fromEntries(
        Object.entries(parentContext).map(([key, value]) => [
          key,
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
        ]),
      );

    // Manually interpolate placeholders using parent's context
    originalSystemPrompt = interpolatePrompt(
      parent.system_prompt,
      parentContextForInterpolation,
    );
    originalUserPrompt = interpolatePrompt(
      parent.user_prompt,
      parentContextForInterpolation,
    );
  } else {
    // Escape placeholders to prevent auto-interpolation
    originalSystemPrompt = escapePlaceholders(parent.system_prompt);
    originalUserPrompt = escapePlaceholders(parent.user_prompt);
  }

  const customVariables: Record<string, unknown> = {
    previousResponse: parent.response,
    followupRequest: followupRequest,
    originalSystemPrompt: originalSystemPrompt,
    originalUserPrompt: originalUserPrompt,
  };

  // Step 4: Call createAndGenerateAiChat (try block for async operation)
  let result;
  try {
    result = await createAndGenerateAiChat(
      parent.profile,
      "followup",
      customVariables,
      parentAiChatId,
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
  if (!result.success || !result.aiChat) {
    return result;
  }

  // Step 5: Auto-update parent records
  const newAiChatId = result.aiChat.id;

  // Check application_letters (try block for database query)
  let linkedLetters;
  try {
    linkedLetters = await db.application_letters.findMany({
      where: { ai_chat: parentAiChatId },
      select: { id: true },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error checking linked letters: ${errorMessage}`,
    };
  }

  // Update application_letters if needed
  if (linkedLetters.length > 0) {
    try {
      await db.application_letters.updateMany({
        where: { ai_chat: parentAiChatId },
        data: { ai_chat: newAiChatId },
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return {
        success: false,
        message: `Error updating linked letters: ${errorMessage}`,
      };
    }
  }

  // Check application_questions (try block for database query)
  let linkedQuestions;
  try {
    linkedQuestions = await db.application_questions.findMany({
      where: { ai_chat: parentAiChatId },
      select: { id: true },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error checking linked questions: ${errorMessage}`,
    };
  }

  // Update application_questions if needed
  if (linkedQuestions.length > 0) {
    try {
      await db.application_questions.updateMany({
        where: { ai_chat: parentAiChatId },
        data: { ai_chat: newAiChatId },
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return {
        success: false,
        message: `Error updating linked questions: ${errorMessage}`,
      };
    }
  }

  // Final result construction outside try block
  return {
    success: true,
    message: `Follow-up ai_chat created successfully (ID: ${newAiChatId})${
      linkedLetters.length > 0 || linkedQuestions.length > 0
        ? `. Updated ${linkedLetters.length} letter(s) and ${linkedQuestions.length} question(s) to reference the new ai_chat.`
        : ""
    }`,
    aiChat: result.aiChat,
  };
}
