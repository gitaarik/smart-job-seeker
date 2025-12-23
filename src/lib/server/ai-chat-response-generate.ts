/**
 * AI Chat response generation using LLM provider
 * Handles generating responses for AI chats using the generic LLM interface
 */

import { db } from "$lib/db";
import { getInterpolatedPrompts } from "./ai-chat-utils";
import { generateChatCompletion } from "./llm";

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
    await db.ai_chat.update({
      where: { id: aiChatId },
      data: { response: responseContent },
    });

    return {
      success: true,
      message: `Response generated for AI chat ID ${aiChatId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating response: ${errorMessage}`,
    };
  }
}
