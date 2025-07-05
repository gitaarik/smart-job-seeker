/**
 * AI Chat full prompt generation utilities
 * Handles generating and updating full prompts for AI chats by combining system and user prompts
 */

import { prisma } from "$lib/db";
import { getInterpolatedPrompts } from "./ai-chat-utils";

/**
 * Generate full prompt for a single AI chat using the same prisma instance
 */
export async function generateAiChatFullPrompt(aiChatId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Get interpolated prompts with variables replaced
    const prompts = await getInterpolatedPrompts(aiChatId);

    if (!prompts) {
      return {
        success: false,
        message: `AI chat with ID ${aiChatId} not found`,
      };
    }

    // Combine system_prompt and user_prompt with 2 newlines
    const fullPrompt =
      `${prompts.systemPrompt}\n\n## User prompt:\n\n${prompts.userPrompt}`;

    // Update the full_prompt field
    await prisma.ai_chat.update({
      where: { id: aiChatId },
      data: { full_prompt: fullPrompt },
    });

    return {
      success: true,
      message: `Full prompt generated for AI chat ID ${aiChatId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating full prompt: ${errorMessage}`,
    };
  }
}
