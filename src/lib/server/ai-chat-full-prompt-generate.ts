/**
 * AI Chat full prompt generation utilities
 * Handles generating and updating full prompts for AI chats by combining system and user prompts
 */

import { prisma } from "$lib/db";

/**
 * Generate full prompt for a single AI chat using the same prisma instance
 */
export async function generateAiChatFullPrompt(aiChatId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Fetch the ai_chat record to get system_prompt, user_prompt, and profile ID
    const aiChat = await prisma.ai_chat.findUnique({
      where: { id: aiChatId },
      select: { system_prompt: true, user_prompt: true, profile: true },
    });

    if (!aiChat) {
      return {
        success: false,
        message: `AI chat with ID ${aiChatId} not found`,
      };
    }

    // Fetch the collected_data for this profile to get schema and data
    const collectedData = await prisma.collected_data.findFirst({
      where: { profile: aiChat.profile },
      select: { schema: true, data: true },
    });

    // Prepare replacements (use empty objects as defaults)
    const schemaValue = collectedData?.schema || "{}";
    const dataValue = collectedData?.data || "{}";

    // Replace handlebar tags in system_prompt
    let interpolatedSystemPrompt = aiChat.system_prompt
      .replace(/{schema}/g, schemaValue)
      .replace(/{data}/g, dataValue);

    // Combine system_prompt and user_prompt with 2 newlines
    const fullPrompt = `${interpolatedSystemPrompt}\n\n## User prompt:\n\n${aiChat.user_prompt}`;

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
