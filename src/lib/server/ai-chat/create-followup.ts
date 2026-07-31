/**
 * Create follow-up ai_chats instances for iterative refinement
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import {
  ai_chats,
  application_letters,
  application_questions,
} from "$lib/server/db/schema";
import type { ChatMessage } from "$lib/server/llm";
import type { GenerationContextOption } from "./generation-context";
import { createAndGenerateAiChat, interpolatePrompt } from "./utils";

/**
 * Escape variable placeholders in a string to prevent auto-interpolation
 * Converts ${variableName} to \${variableName}
 */
function escapePlaceholders(text: string): string {
  return text.replace(/\$\{/g, "\\${");
}

/**
 * Create a follow-up ai_chats instance to refine a previous AI-generated response
 *
 * The follow-up will with:
 * - The previous response (so AI knows what to refine)
 * - The follow-up request (what the user wants to change)
 * - Optionally, the original context (schema, data, jobDescription, etc.)
 *
 * @param parentAiChatId - The ID of the parent ai_chats record to follow up on
 * @param followupRequest - The user's follow-up request describing what to refine
 * @param options - Configuration options
 * @param options.includeOriginalContext - If true, interpolate parent's context variables into the prompts (default: false)
 * @returns Object with success status, message, and the created ai_chats record (if successful)
 */
export async function createFollowupAiChat(
  parentAiChatId: number,
  followupRequest: string,
  options?: {
    includeOriginalContext?: boolean;
    promptType?: string;
    customVariables?: Record<string, unknown>;
    profileDataFields?: string[];
    /** Evidence to assemble for this turn — see generation-context.ts. */
    context?: GenerationContextOption;
    /** Prior turns of this thread, replayed as real messages. */
    historyMessages?: ChatMessage[];
  },
): Promise<{
  success: boolean;
  message: string;
  aiChat?: {
    id: number;
    profile_id: number;
    system_prompt: string;
    user_prompt: string;
    full_prompt: string | null;
    response: string | null;
    date_created: Date | null;
    date_updated: Date | null;
  };
}> {
  const includeOriginalContext = options?.includeOriginalContext ?? false;
  const promptType = options?.promptType ?? "followup";

  // Step 1: Fetch parent ai_chats record (try block for database query)
  let parent;
  try {
    parent = await db.query.ai_chats.findFirst({
      where: eq(ai_chats.id, parentAiChatId),
      columns: {
        profile_id: true,
        context: true,
        response: true,
        system_prompt: true,
        user_prompt: true,
        followup_to: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Database error fetching parent ai_chats: ${errorMessage}`,
    };
  }

  // Step 2: Validation outside try block
  if (!parent) {
    return {
      success: false,
      message: `Parent ai_chats with ID ${parentAiChatId} not found`,
    };
  }

  if (!parent.response) {
    return {
      success: false,
      message:
        `Parent ai_chats ${parentAiChatId} does not have a response yet. Cannot create follow-up.`,
    };
  }

  // Step 3: Walk up the followup chain to find the root (original) ai_chat.
  // This prevents prompt stacking: each followup always gets the clean original
  // context instead of nested copies of previous followup prompts.
  let root = parent;
  if (includeOriginalContext && parent.followup_to) {
    let currentId = parent.followup_to;
    // Walk up the chain (with a safety limit to prevent infinite loops)
    for (let i = 0; i < 50 && currentId; i++) {
      const ancestor = await db.query.ai_chats.findFirst({
        where: eq(ai_chats.id, currentId),
        columns: {
          context: true,
          system_prompt: true,
          user_prompt: true,
          followup_to: true,
        },
      });
      if (!ancestor) break;
      root = {
        ...root,
        context: ancestor.context,
        system_prompt: ancestor.system_prompt,
        user_prompt: ancestor.user_prompt,
      };
      currentId = ancestor.followup_to;
    }
  }

  // Step 4: Prepare custom variables
  // Use the ROOT chat's context and prompts (clean original), but the PARENT's response (most recent)
  const rootContext = (root.context as Record<string, unknown>) || {};

  let originalSystemPrompt: string;
  let originalUserPrompt: string;

  if (includeOriginalContext) {
    // Convert root context to string format for interpolation
    const rootContextForInterpolation: Record<string, string> = Object
      .fromEntries(
        Object.entries(rootContext).map(([key, value]) => [
          key,
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
        ]),
      );

    // Interpolate the ROOT's prompts with its own context
    originalSystemPrompt = interpolatePrompt(
      root.system_prompt,
      rootContextForInterpolation,
    );
    originalUserPrompt = interpolatePrompt(
      root.user_prompt,
      rootContextForInterpolation,
    );
  } else {
    // Escape placeholders to prevent auto-interpolation
    originalSystemPrompt = escapePlaceholders(root.system_prompt);
    originalUserPrompt = escapePlaceholders(root.user_prompt);
  }

  // Extract letter text from structured JSON responses (e.g. { letter: "...", summary: "..." })
  // so the next followup sees the actual letter, not raw JSON
  let previousResponse = parent.response;
  if (previousResponse) {
    try {
      const parsed = JSON.parse(previousResponse);
      if (parsed && typeof parsed.text === "string") {
        previousResponse = parsed.text;
      } else if (parsed && typeof parsed.letter === "string") {
        previousResponse = parsed.letter;
      }
    } catch {
      // Not JSON, use as-is
    }
  }

  const customVariables: Record<string, unknown> = {
    previousResponse,
    followupRequest: followupRequest,
    originalSystemPrompt: originalSystemPrompt,
    originalUserPrompt: originalUserPrompt,
    ...options?.customVariables,
  };

  // Step 4: Call createAndGenerateAiChat (try block for async operation)
  let result;
  try {
    result = await createAndGenerateAiChat(
      parent.profile_id,
      promptType,
      customVariables,
      parentAiChatId,
      {
        profileDataFields: options?.profileDataFields ?? [],
        context: options?.context,
        historyMessages: options?.historyMessages,
      },
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
    linkedLetters = await db.query.application_letters.findMany({
      where: eq(application_letters.ai_chat_id, parentAiChatId),
      columns: { id: true },
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
      await db.update(application_letters).set({ ai_chat_id: newAiChatId })
        .where(eq(application_letters.ai_chat_id, parentAiChatId));
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
    linkedQuestions = await db.query.application_questions.findMany({
      where: eq(application_questions.ai_chat_id, parentAiChatId),
      columns: { id: true },
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
      await db.update(application_questions).set({ ai_chat_id: newAiChatId })
        .where(eq(application_questions.ai_chat_id, parentAiChatId));
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
    message: `Follow-up ai_chats created successfully (ID: ${newAiChatId})${
      linkedLetters.length > 0 || linkedQuestions.length > 0
        ? `. Updated ${linkedLetters.length} letter(s) and ${linkedQuestions.length} question(s) to reference the new ai_chats.`
        : ""
    }`,
    aiChat: result.aiChat,
  };
}
