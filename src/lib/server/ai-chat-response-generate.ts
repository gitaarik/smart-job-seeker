/**
 * AI Chat response generation using Groq API
 * Handles generating responses for AI chats using Groq's chat completion API
 */

import { prisma } from "$lib/db";
import { getInterpolatedPrompts } from "./ai-chat-utils";
import { getEnv } from "$lib/tools/get-env";
import Groq from "groq-sdk";

// Initialize Groq client
const groq = new Groq({
  apiKey: getEnv("GROQ_API_KEY", ""),
});

/**
 * Generate response for a single AI chat using Groq API
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

    // Call Groq API with separate system and user messages
    const completion = await groq.chat.completions.create({
      model: "mixtral-8x7b-32768", // Cost-effective model with good performance
      messages: [
        {
          role: "system",
          content: prompts.systemPrompt,
        },
        {
          role: "user",
          content: prompts.userPrompt,
        },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    // Extract response content
    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      return {
        success: false,
        message: `No response generated for AI chat ID ${aiChatId}`,
      };
    }

    // Update the response field
    await prisma.ai_chat.update({
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
