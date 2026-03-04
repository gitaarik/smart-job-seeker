/**
 * AI Chat response generation using LLM provider
 * Handles generating responses for AI chats using the generic LLM interface
 */

import { db } from "$lib/server/db";
import { getInterpolatedPrompts } from "./utils";
import {
  generateChatCompletion,
  LLMAuthenticationError,
  LLMQuotaExceededError,
  LLMRateLimitError,
} from "$lib/server/llm";
import { getErrorMessage } from "$lib/server/utils/errors";

/**
 * Generate response for a single AI chat using LLM provider
 * Feeds system_prompt and user_prompt separately with variable interpolation
 */
export async function generateAiChatResponse(aiChatId: number): Promise<{
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

    // Generate response using generic LLM function
    const responseContent = await generateChatCompletion([
      { role: "system", content: prompts.systemPrompt },
      { role: "user", content: prompts.userPrompt },
    ]);

    // Update the response field
    await db.ai_chats.update({
      where: { id: aiChatId },
      data: { response: responseContent },
    });

    return {
      success: true,
      message: `Response generated for AI chat ID ${aiChatId}`,
    };
  } catch (error) {
    // Provide specific error messages for LLM errors
    if (error instanceof LLMQuotaExceededError) {
      return {
        success: false,
        message:
          `${error.message}. Please add more credits or switch providers.`,
      };
    }

    if (error instanceof LLMAuthenticationError) {
      return {
        success: false,
        message: `${error.message}. Please check your API key configuration.`,
      };
    }

    if (error instanceof LLMRateLimitError) {
      return {
        success: false,
        message: `${error.message}. Please try again later.`,
      };
    }

    // Generic error handling
    return {
      success: false,
      message: `Error generating response: ${getErrorMessage(error)}`,
    };
  }
}
