/**
 * Shared utilities for AI chat prompt handling
 */

import { prisma } from "$lib/db";

/**
 * Replace a variable placeholder in text
 * Replaces all occurrences of {variableName} with variableValue
 */
export function replaceVariable(
  text: string,
  variableName: string,
  variableValue: string,
): string {
  return text.replace(new RegExp(`\\{${variableName}\\}`, "g"), variableValue);
}

/**
 * Fetch and interpolate prompts for an AI chat
 * Returns system_prompt and user_prompt with {schema} and {data} replaced
 */
export async function getInterpolatedPrompts(aiChatId: number): Promise<
  {
    systemPrompt: string;
    userPrompt: string;
  } | null
> {
  // Fetch the ai_chat record
  const aiChat = await prisma.ai_chat.findUnique({
    where: { id: aiChatId },
    select: { system_prompt: true, user_prompt: true, profile: true },
  });

  if (!aiChat) {
    return null;
  }

  // Fetch the collected_data for this profile
  const collectedData = await prisma.collected_data.findFirst({
    where: { profile: aiChat.profile },
    select: { schema: true, data: true },
  });

  // Prepare replacements (use empty objects as defaults)
  const schemaValue = collectedData?.schema || "{}";
  const dataValue = collectedData?.data || "{}";

  // Replace variables in both prompts
  const systemPrompt = replaceVariable(
    replaceVariable(aiChat.system_prompt, "schema", schemaValue),
    "data",
    dataValue,
  );

  const userPrompt = replaceVariable(
    replaceVariable(aiChat.user_prompt, "schema", schemaValue),
    "data",
    dataValue,
  );

  return {
    systemPrompt,
    userPrompt,
  };
}
