/**
 * Shared utilities for AI chat prompt handling
 */

import { db } from "$lib/db";
import { generateAiChatFullPrompt } from "./ai-chat-full-prompt-generate";
import { generateAiChatResponse } from "./ai-chat-response-generate";

/**
 * Interpolate variables in a prompt string
 * Replaces ${schema} and ${data} with provided values
 */
export function interpolatePrompt(
  text: string,
  variables: { schema: string; data: string },
): string {
  return text
    .replace(/\$\{schema\}/g, variables.schema)
    .replace(/\$\{data\}/g, variables.data);
}

/**
 * Fetch and interpolate prompts for an AI chat
 * Returns system_prompt and user_prompt with ${schema} and ${data} replaced
 */
export async function getInterpolatedPrompts(aiChatId: number): Promise<
  {
    systemPrompt: string;
    userPrompt: string;
  } | null
> {
  // Fetch the ai_chat record
  const aiChat = await db.ai_chat.findUnique({
    where: { id: aiChatId },
    select: { system_prompt: true, user_prompt: true, profile: true },
  });

  if (!aiChat) {
    return null;
  }

  // Fetch the collected_data for this profile
  const collectedData = await db.collected_data.findFirst({
    where: { profile: aiChat.profile },
    select: { schema: true, data: true },
  });

  // Prepare replacements (use empty objects as defaults)
  const variables = {
    schema: collectedData?.schema || "{}",
    data: collectedData?.data || "{}",
  };

  // Interpolate variables in both prompts
  const systemPrompt = interpolatePrompt(aiChat.system_prompt, variables);
  const userPrompt = interpolatePrompt(aiChat.user_prompt, variables);

  return {
    systemPrompt,
    userPrompt,
  };
}

/**
 * Create and fully generate an AI chat instance
 * Orchestrates the entire process:
 * 1. Creates ai_chat record with profile, system_prompt, and user_prompt
 * 2. Generates full_prompt with variable interpolation
 * 3. Generates response via Groq API
 * 4. Returns the complete ai_chat record with date_created auto-set by database
 *
 * @param profileId - The profile ID for this AI chat
 * @param systemPrompt - System prompt with optional ${schema} and ${data} placeholders
 * @param userPrompt - User prompt with optional ${schema} and ${data} placeholders
 * @returns Object with success status, message, and the created ai_chat record (if successful)
 */
export async function createAndGenerateAiChat(
  profileId: number,
  systemPrompt: string,
  userPrompt: string,
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
    // Step 1: Create the ai_chat record
    const aiChat = await db.ai_chat.create({
      data: {
        profile: profileId,
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        date_created: new Date(),
      },
    });

    // Step 2: Generate the full prompt (interpolates variables)
    const fullPromptResult = await generateAiChatFullPrompt(aiChat.id);

    if (!fullPromptResult.success) {
      return {
        success: false,
        message: `Failed to generate full prompt: ${fullPromptResult.message}`,
      };
    }

    // Step 3: Generate the AI response
    const responseResult = await generateAiChatResponse(aiChat.id);

    if (!responseResult.success) {
      return {
        success: false,
        message: `Failed to generate response: ${responseResult.message}`,
      };
    }

    // Step 4: Fetch the complete ai_chat record with all generated fields
    const completeAiChat = await db.ai_chat.findUnique({
      where: { id: aiChat.id },
      select: {
        id: true,
        profile: true,
        system_prompt: true,
        user_prompt: true,
        full_prompt: true,
        response: true,
        date_created: true,
        date_updated: true,
      },
    });

    if (!completeAiChat) {
      return {
        success: false,
        message:
          `Failed to retrieve created ai_chat record with ID ${aiChat.id}`,
      };
    }

    return {
      success: true,
      message: `AI chat created and generated successfully`,
      aiChat: completeAiChat,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error creating and generating ai_chat: ${errorMessage}`,
    };
  }
}
